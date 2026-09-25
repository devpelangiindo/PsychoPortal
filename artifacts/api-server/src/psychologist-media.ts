import express, {type Express,type RequestHandler} from 'express';
import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';

export const psychologistMediaSql=`CREATE TABLE IF NOT EXISTS psychologist_media (
 id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('photo','signature')),
 image_data bytea NOT NULL, mime_type text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);`;
export const mediaPathPattern=/^\/api\/psychologist-media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
export async function readStoredSignature(pool:Pick<Pool,'query'>,value:string) {
  const match=mediaPathPattern.exec(value);
  if(!match) return undefined;
  const result=await pool.query("SELECT image_data FROM psychologist_media WHERE id=$1 AND kind='signature'",[match[1]]);
  return result.rows[0]?.image_data;
}
export function registerPsychologistMedia(app:Express,pool:Pick<Pool,'query'>,auth:RequestHandler,admin:RequestHandler) {
  app.post('/api/admin/psychologist-media/:kind',auth,admin,express.raw({type:['image/jpeg','image/png','image/webp'],limit:'5mb'}),async(req,res,next)=>{
    if(!['photo','signature'].includes(String(req.params.kind))) {res.status(400).json({message:'Jenis gambar tidak valid'});return;}
    let data:Buffer;
    try {
      if(!Buffer.isBuffer(req.body)||!req.body.length) throw new Error('empty');
      const input=sharp(req.body,{limitInputPixels:20_000_000});
      const metadata=await input.metadata();
      if(!['jpeg','png','webp'].includes(metadata.format||'')) throw new Error('format');
      data=await input.rotate().resize({width:1200,height:1200,fit:'inside',withoutEnlargement:true}).png().toBuffer();
    } catch {res.status(400).json({message:'Gunakan JPEG, PNG, atau WebP yang valid, maksimal 5 MB dan 20 megapiksel.'});return;}
    try {
      const id=randomUUID();
      await pool.query('INSERT INTO psychologist_media(id,kind,image_data,mime_type) VALUES ($1,$2,$3,$4)',[id,req.params.kind,data,'image/png']);
      res.status(201).json({url:`/api/psychologist-media/${id}`});
    } catch(error){next(error);}
  });
  const image=(privateAccess:boolean):RequestHandler=>async(req,res,next)=>{
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(req.params.id))){res.status(404).end();return;}
    try {
      const result=await pool.query(`SELECT image_data,mime_type FROM psychologist_media WHERE id=$1 ${privateAccess?'':"AND kind='photo'"}`,[req.params.id]);
      if(!result.rowCount){res.status(404).end();return;}
      res.setHeader('Cache-Control',privateAccess?'no-store':'public, max-age=86400');
      res.type(result.rows[0].mime_type).send(result.rows[0].image_data);
    }catch(error){next(error);}
  };
  app.get('/api/psychologist-media/:id',image(false));
  app.get('/api/admin/psychologist-media/:id',auth,admin,image(true));
}
