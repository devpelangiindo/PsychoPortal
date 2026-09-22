import express, { type Express, type RequestHandler } from 'express';
import type { Pool } from 'pg';
import sharp from 'sharp';
import { z } from 'zod/v4';

export const trainingPromoSchemaSql = `
CREATE TABLE IF NOT EXISTS training_promos (
  id serial PRIMARY KEY, title varchar(255) NOT NULL, description varchar(1000) NOT NULL,
  button_text varchar(100) NOT NULL, link_url varchar(2000) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
  image_data bytea, created_by varchar REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS training_promos_public_idx ON training_promos(is_active, sort_order, id) WHERE deleted_at IS NULL;
`;

const schema = z.object({
  title: z.string().trim().min(2).max(255), description: z.string().trim().min(3).max(1000),
  buttonText: z.string().trim().min(2).max(100),
  linkUrl: z.string().trim().min(1).max(2000).refine(value => {
    if (/[\\\u0000-\u0020]/.test(value)) return false;
    if (value.startsWith('/') && !value.startsWith('//')) return true;
    try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
  }, 'Gunakan tautan http/https atau halaman internal yang diawali /.') ,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0), isActive: z.boolean().default(true),
});
const select = `SELECT id,title,description,button_text AS "buttonText",link_url AS "linkUrl",
  sort_order AS "sortOrder",is_active AS "isActive",image_data IS NOT NULL AS "hasImage",updated_at AS "updatedAt" FROM training_promos`;
const safe = (handler: RequestHandler): RequestHandler => (req,res,next) => {
  if(req.params.promoId && (!/^\d+$/.test(String(req.params.promoId)) || Number(req.params.promoId) < 1 || Number(req.params.promoId) > 2147483647)) {
    res.status(400).json({message:'ID promo tidak valid'}); return;
  }
  Promise.resolve(handler(req,res,next)).catch(next);
};

export function registerTrainingPromoRoutes(app: Express, pool: Pick<Pool,'query'>, authenticate: RequestHandler, authorize: RequestHandler) {
  app.get('/api/training-promos', safe(async (_req,res) => {
    res.json((await pool.query(`${select} WHERE deleted_at IS NULL AND is_active=true ORDER BY sort_order,id`)).rows);
  }));
  app.get('/api/admin/training-promos', authenticate, authorize, safe(async (_req,res) => {
    res.json((await pool.query(`${select} WHERE deleted_at IS NULL ORDER BY sort_order,id`)).rows);
  }));
  app.post('/api/admin/training-promos', authenticate, authorize, safe(async (req:any,res) => {
    const parsed=schema.safeParse(req.body);
    if(!parsed.success) { res.status(400).json({message:'Data Promo & Info tidak valid',errors:parsed.error.flatten()}); return; }
    const p=parsed.data;
    const result=await pool.query(`INSERT INTO training_promos(title,description,button_text,link_url,sort_order,is_active,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,[p.title,p.description,p.buttonText,p.linkUrl,p.sortOrder,p.isActive,req.user.claims.sub]);
    res.status(201).json(result.rows[0]);
  }));
  app.put('/api/admin/training-promos/:promoId', authenticate, authorize, safe(async (req,res) => {
    const parsed=schema.safeParse(req.body);
    if(!parsed.success) { res.status(400).json({message:'Data Promo & Info tidak valid',errors:parsed.error.flatten()}); return; }
    const p=parsed.data;
    const result=await pool.query(`UPDATE training_promos SET title=$1,description=$2,button_text=$3,link_url=$4,sort_order=$5,is_active=$6,updated_at=now()
      WHERE id=$7 AND deleted_at IS NULL RETURNING id`,[p.title,p.description,p.buttonText,p.linkUrl,p.sortOrder,p.isActive,Number(req.params.promoId)]);
    if(!result.rowCount) {res.status(404).json({message:'Promo tidak ditemukan'});return;}
    res.json(result.rows[0]);
  }));
  app.delete('/api/admin/training-promos/:promoId', authenticate, authorize, safe(async (req,res) => {
    const result=await pool.query(`UPDATE training_promos SET deleted_at=now(),is_active=false,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id`,[Number(req.params.promoId)]);
    res.status(result.rowCount ? 200 : 404).json({message:result.rowCount ? 'Promo dihapus' : 'Promo tidak ditemukan'});
  }));
  const image: (admin:boolean)=>RequestHandler = admin => safe(async(req,res)=>{
    const result=await pool.query(`SELECT image_data FROM training_promos WHERE id=$1 AND deleted_at IS NULL ${admin ? '' : 'AND is_active=true'}`,[Number(req.params.promoId)]);
    if(!result.rows[0]?.image_data) {res.status(404).end();return;}
    res.setHeader('Cache-Control','no-store');
    res.type('image/jpeg').send(result.rows[0].image_data);
  });
  app.get('/api/training-promos/:promoId/image',image(false));
  app.get('/api/admin/training-promos/:promoId/image',authenticate,authorize,image(true));
  app.put('/api/admin/training-promos/:promoId/image',authenticate,authorize,express.raw({type:['image/jpeg','image/png','image/webp'],limit:'8mb'}),safe(async(req,res)=>{
    let jpeg:Buffer;
    try {
      if(!Buffer.isBuffer(req.body) || !req.body.length) throw new Error('missing image');
      const input=sharp(req.body,{limitInputPixels:25_000_000});
      const meta=await input.metadata();
      if(!['jpeg','png','webp'].includes(meta.format || '')) throw new Error('invalid format');
      jpeg=await input.rotate().resize({width:1200,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
    } catch {res.status(400).json({message:'Gunakan gambar JPEG, PNG, atau WebP yang valid, maksimal 8 MB dan 25 megapiksel.'});return;}
    const result=await pool.query(`UPDATE training_promos SET image_data=$1,updated_at=now() WHERE id=$2 AND deleted_at IS NULL RETURNING id`,[jpeg,Number(req.params.promoId)]);
    res.status(result.rowCount ? 200 : 404).json(result.rows[0] || {message:'Promo tidak ditemukan'});
  }));
  app.delete('/api/admin/training-promos/:promoId/image',authenticate,authorize,safe(async(req,res)=>{
    const result=await pool.query(`UPDATE training_promos SET image_data=NULL,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id`,[Number(req.params.promoId)]);
    res.status(result.rowCount ? 200 : 404).json(result.rows[0] || {message:'Promo tidak ditemukan'});
  }));
}
