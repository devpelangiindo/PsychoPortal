import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sharp from 'sharp';
import { PGlite } from '@electric-sql/pglite';
import { registerTrainingPromoRoutes, trainingPromoSchemaSql } from '../src/training-promos';

test('training promos: authorization, CRUD, order, images and publication visibility', async t => {
  const db=new PGlite();
  await db.exec(`CREATE TABLE users(id varchar PRIMARY KEY); INSERT INTO users VALUES ('admin');`);
  await db.exec(trainingPromoSchemaSql);
  await db.exec(trainingPromoSchemaSql);
  const pool:any={query:async(sql:string,params:any[]=[])=>{const result=await db.query(sql,params);return {...result,rowCount:result.rows.length || result.affectedRows || 0,rows:result.rows.map((r:any)=>r.image_data?{...r,image_data:Buffer.from(r.image_data)}:r)};}};
  const app=express();app.use(express.json());
  registerTrainingPromoRoutes(app,pool,(req:any,res,next)=>{
    if(!req.headers.authorization){res.status(401).end();return;}
    req.user={claims:{sub:'admin'},role:req.headers.authorization};next();
  },(req:any,res,next)=>{if(req.user.role!=='admin'){res.status(403).end();return;}next();});
  app.use((err:any,_req:any,res:any,_next:any)=>res.status(err.status||500).json({message:err.message}));
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();});
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  const request=(path:string,method='GET',body?:any,role='admin')=>fetch(base+path,{method,headers:{...(role?{Authorization:role}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const prefix='/api/admin/training-promos';
  const valid={title:'Promo Pelatihan',description:'Informasi program pilihan',buttonText:'Lihat agenda',linkUrl:'/produk-layanan/pelatihan',sortOrder:2,isActive:true};
  for(const method of ['GET','POST','PUT','DELETE']) {
    const path=prefix+(['PUT','DELETE'].includes(method)?'/1':'');
    assert.equal((await request(path,method,method==='GET'?undefined:valid,'')).status,401);
    assert.equal((await request(path,method,method==='GET'?undefined:valid,'customer')).status,403);
  }
  const created=await request(prefix,'POST',valid);assert.equal(created.status,201);
  const {id}=await created.json();
  await request(prefix,'POST',{...valid,title:'Promo pertama',sortOrder:0});
  const hidden=await (await request(prefix,'POST',{...valid,title:'Belum tampil',isActive:false})).json();
  let list=await (await request('/api/training-promos','GET',undefined,'')).json();
  assert.equal(list.length,2);assert.equal(list[0].title,'Promo pertama');assert.equal(list[1].hasImage,false);
  assert.equal((await (await request(prefix)).json()).length,3);
  for(const linkUrl of ['javascript:alert(1)','//example.com','/\\example.com','https://']) assert.equal((await request(prefix,'POST',{...valid,linkUrl})).status,400);
  assert.equal((await request(prefix+'/invalid','PUT',valid)).status,400);
  assert.equal((await request(prefix+'/99999','PUT',valid)).status,404);
  const upload=(target:number,body:Buffer,role='admin')=>fetch(`${base}${prefix}/${target}/image`,{method:'PUT',headers:{Authorization:role,'Content-Type':'image/png'},body});
  const png=await sharp({create:{width:500,height:900,channels:3,background:'green'}}).png().toBuffer();
  assert.equal((await upload(id,png,'customer')).status,403);
  assert.equal((await upload(id,Buffer.from('not an image'))).status,400);
  assert.equal((await upload(id,png)).status,200);
  const image=await request(`/api/training-promos/${id}/image`,'GET',undefined,'');
  assert.equal(image.headers.get('content-type'),'image/jpeg');
  const meta=await sharp(Buffer.from(await image.arrayBuffer())).metadata();assert.equal(meta.width,500);assert.equal(meta.height,900);
  list=await (await request('/api/training-promos')).json();assert.equal(list[1].hasImage,true);assert.equal('image_data' in list[1],false);
  assert.equal((await upload(hidden.id,png)).status,200);
  assert.equal((await request(`/api/training-promos/${hidden.id}/image`)).status,404);
  assert.equal((await request(`${prefix}/${hidden.id}/image`)).status,200);
  assert.equal((await request(`${prefix}/${id}`,'PUT',{...valid,title:'Judul baru',isActive:false})).status,200);
  assert.equal((await request(`/api/training-promos/${id}/image`)).status,404);
  assert.equal((await request(`${prefix}/${id}/image`,'DELETE')).status,200);
  assert.equal((await request(`${prefix}/${id}/image`)).status,404);
  assert.equal((await request(`${prefix}/${id}`,'DELETE')).status,200);
  assert.equal((await upload(id,png)).status,404);
  assert.equal((await (await request(prefix)).json()).length,2);
});
