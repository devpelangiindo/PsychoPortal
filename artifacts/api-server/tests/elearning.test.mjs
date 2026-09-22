import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transform } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { z } from 'zod';
import express from 'express';

// Exercise the production route handlers and migration against isolated PostgreSQL.
// Authentication middleware and unrelated HTML sanitization are outside this test.
const source = readFileSync(new URL('../src/routes/routes.ts', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const migration = source.split('async function ensureDigitalProductInfrastructure() {')[1].split('await pool.query(`')[1].split('`);')[0];
const schema = source.slice(source.indexOf('const digitalProductSchema ='), source.indexOf('const digitalOrderSchema ='));
const routes = source.slice(source.indexOf('  const digitalProductSelect ='), source.indexOf('  const physicalProductSelect ='));

test('E-Learning catalog migration, CRUD, category isolation and private access links', async () => {
  const db = new PGlite();
  await db.exec(`CREATE TABLE users(id varchar PRIMARY KEY); CREATE TABLE orders(id serial PRIMARY KEY, user_id varchar, status text, payment_status text, paid_at timestamp);
    INSERT INTO users VALUES ('admin');`);
  // Model an existing installation before the new category migration.
  await db.exec(migration.replace(/ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS category[^;]+;/, ''));
  await db.exec(`INSERT INTO digital_products(slug,name,short_description,description,price) VALUES ('legacy','Legacy','Existing product','Existing description',100);`);
  await db.exec(migration);
  await db.exec(migration);
  assert.equal((await db.query(`SELECT category FROM digital_products WHERE slug='legacy'`)).rows[0].category, 'digital');
  const handlers = new Map();
  const app = Object.fromEntries(['get','post','put','delete'].map(method => [method, (path,...stack) => handlers.set(`${method} ${path}`,stack.at(-1))]));
  const pool = { query: async (...args) => { const result = await db.query(...args); return {...result, rowCount: result.rows.length || result.affectedRows || 0}; } };
  const { code } = await transform(schema + routes, {loader:'ts',format:'cjs'});
  new Function('app','pool','z','express','isAuthenticated','canManageDigitalProducts','sanitizeRichText','makeDigitalProductSlug', code)(app,pool,z,express,()=>{},()=>{},value=>value,value=>value);
  async function call(method,path,{body={},query={},params={}}={}) {
    let status=200,data;
    const response={status(value){status=value;return this;},json(value){data=value;return this;}};
    await handlers.get(`${method} ${path}`)({body,query,params,user:{claims:{sub:'admin'}}},response);
    return {status,data};
  }
  const body={category:'elearning',slug:'belajar',name:'Belajar Mandiri',shortDescription:'Ringkasan video',description:'Rekaman pelatihan',price:100000,deliveryUrl:'https://example.com/private-course'};
  const created=await call('post','/api/admin/digital-products',{body});
  assert.equal(created.status,201);
  const productId=created.data.id;
  assert.equal((await call('get','/api/digital-products')).data.length,1);
  const catalog=await call('get','/api/digital-products',{query:{category:'elearning'}});
  assert.equal(catalog.data.length,1);
  assert.equal(catalog.data[0].name,body.name);
  assert.equal(catalog.data[0].hasDeliveryUrl,true);
  assert.equal('deliveryUrl' in catalog.data[0],false);
  assert.equal(JSON.stringify(catalog.data).includes('private-course'),false);
  const admin=await call('get','/api/admin/digital-products',{query:{category:'elearning'}});
  assert.equal(admin.data[0].deliveryUrl,body.deliveryUrl);
  assert.equal((await call('get','/api/digital-products/:slug',{params:{slug:'belajar'},query:{category:'digital'}})).status,404);
  assert.equal((await call('get','/api/digital-products/:slug',{params:{slug:'belajar'},query:{category:'elearning'}})).status,200);
  assert.equal((await call('put','/api/admin/digital-products/:productId',{params:{productId},body:{...body,category:'digital'}})).status,404);
  assert.equal((await call('put','/api/admin/digital-products/:productId',{params:{productId},body:{...body,name:'Video Diperbarui'}})).status,200);
  assert.equal((await call('post','/api/admin/digital-products',{body:{...body,category:'invalid'}})).status,400);
  assert.equal((await call('post','/api/admin/digital-products',{body:{...body,deliveryUrl:'javascript:alert(1)'}})).status,400);
  const accessPath='/api/digital-products/purchases/:productId/link';
  assert.equal((await call('get',accessPath,{params:{productId}})).status,404);
  await db.exec(`INSERT INTO orders(id,user_id,status,payment_status) VALUES (1,'admin','pending','pending');`);
  await db.query(`INSERT INTO digital_order_items(order_id,product_id,product_name,price) VALUES (1,$1,'Video',100000)`,[productId]);
  assert.equal((await call('get',accessPath,{params:{productId}})).status,404);
  await db.exec(`UPDATE orders SET payment_status='paid',paid_at=now() WHERE id=1;`);
  assert.equal((await call('get',accessPath,{params:{productId}})).data.url,body.deliveryUrl);
  assert.equal((await db.query('SELECT * FROM digital_product_access_logs')).rows.length,1);
  await call('delete','/api/admin/digital-products/:productId',{params:{productId}});
  assert.equal((await call('get','/api/digital-products',{query:{category:'elearning'}})).data.length,0);
  assert.equal((await call('get','/api/admin/digital-products',{query:{category:'elearning'}})).data.length,1);
  assert.equal((await call('get','/api/digital-products')).data[0].slug,'legacy');
  await db.close();
});
