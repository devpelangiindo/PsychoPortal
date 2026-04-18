--
-- PostgreSQL database dump
--

\restrict 5DyCCSqop67dIYJ9dhA1CrIx9pVxJgdxfcUXPXARRJIRga8m0XDTSsLBdQyOQ0z

-- Dumped from database version 16.12 (8dbf2dd)
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: assessments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.assessments (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text NOT NULL,
    price numeric(10,2) NOT NULL,
    duration character varying(50) NOT NULL,
    age_range character varying(50) NOT NULL,
    type character varying(100) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.assessments OWNER TO neondb_owner;

--
-- Name: assessments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.assessments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.assessments_id_seq OWNER TO neondb_owner;

--
-- Name: assessments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.assessments_id_seq OWNED BY public.assessments.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    assessment_id integer NOT NULL,
    price numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.order_items OWNER TO neondb_owner;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO neondb_owner;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    payment_id character varying,
    payment_status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    payment_method character varying(50),
    paid_at timestamp without time zone,
    paid_amount numeric(10,2)
);


ALTER TABLE public.orders OWNER TO neondb_owner;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO neondb_owner;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.otp_verifications (
    id integer NOT NULL,
    email character varying NOT NULL,
    otp character varying(6) NOT NULL,
    purpose character varying NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.otp_verifications OWNER TO neondb_owner;

--
-- Name: otp_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.otp_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.otp_verifications_id_seq OWNER TO neondb_owner;

--
-- Name: otp_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.otp_verifications_id_seq OWNED BY public.otp_verifications.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO neondb_owner;

--
-- Name: user_assessments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_assessments (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    assessment_id integer NOT NULL,
    order_id integer NOT NULL,
    status character varying(50) DEFAULT 'available'::character varying NOT NULL,
    results jsonb,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_assessments OWNER TO neondb_owner;

--
-- Name: user_assessments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.user_assessments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_assessments_id_seq OWNER TO neondb_owner;

--
-- Name: user_assessments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.user_assessments_id_seq OWNED BY public.user_assessments.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id character varying NOT NULL,
    email character varying NOT NULL,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    password character varying,
    whatsapp_number character varying,
    is_email_verified boolean DEFAULT false,
    auth_provider character varying DEFAULT 'custom'::character varying,
    role character varying DEFAULT 'user'::character varying,
    is_active boolean DEFAULT true,
    last_login_at timestamp without time zone
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: assessments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.assessments ALTER COLUMN id SET DEFAULT nextval('public.assessments_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: otp_verifications id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.otp_verifications ALTER COLUMN id SET DEFAULT nextval('public.otp_verifications_id_seq'::regclass);


--
-- Name: user_assessments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_assessments ALTER COLUMN id SET DEFAULT nextval('public.user_assessments_id_seq'::regclass);


--
-- Data for Name: assessments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.assessments (id, name, description, price, duration, age_range, type, is_active, created_at) FROM stdin;
8	Inventori Gaya Belajar	Mengenali cara belajar pribadi dan pendekatan pendidikan yang optimal. Mengukur moda belajar visual, auditori, kinestetik, dan baca/tulis.	0.00	20-30 menit	Usia 12+	learning	t	2025-07-05 05:55:27.979069
7	Asesmen Profil Sensori	Tes pola respon anak dan dewasa terhadap rangsangan sensorik, yang berkaitan dengan cara belajar dan cara hidup. Follow-up bersama tim psikolog klinis ternama.	400000.00	30-45 menit	Usia 3-65+	sensory	t	2025-07-05 05:55:27.911119
9	Kecerdasan Majemuk	Mengidentifikasi profil kecerdasan majemuk individu meliputi 7 dimensi: Visual Spasial, Linguistik, Logis Matematis, Kinestetik, Musik, Interpersonal, dan Intrapersonal untuk mengoptimalkan potensi diri.	0.00	20-30 menit	Usia 12-25	intelligence	t	2025-09-21 05:59:57.916182
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.order_items (id, order_id, assessment_id, price, created_at) FROM stdin;
194	186	7	400000.00	2025-07-24 09:05:32.664698
195	186	8	0.00	2025-07-24 09:05:32.716915
196	187	7	400000.00	2025-07-24 09:06:03.241692
197	187	8	0.00	2025-07-24 09:06:03.291375
198	188	7	400000.00	2025-07-24 09:09:41.403313
199	189	7	400000.00	2025-07-24 09:10:25.016706
200	190	7	400000.00	2025-07-24 09:12:14.189271
201	191	8	0.00	2025-07-24 09:14:50.26613
202	191	7	400000.00	2025-07-24 09:14:50.326258
203	192	7	400000.00	2025-07-24 09:17:20.914275
204	193	7	400000.00	2025-07-24 09:21:52.99407
205	194	7	400000.00	2025-07-24 09:23:00.759925
206	195	7	400000.00	2025-07-24 09:47:17.517573
207	196	7	400000.00	2025-07-24 10:01:05.547896
208	197	7	400000.00	2025-07-24 10:05:27.163223
209	198	8	0.00	2025-07-24 10:06:08.380719
210	199	7	400000.00	2025-07-24 10:06:46.026668
211	200	7	400000.00	2025-07-24 10:18:27.743509
212	201	7	400000.00	2025-07-24 10:47:10.565344
213	202	7	400000.00	2025-07-24 10:52:57.809242
214	203	7	400000.00	2025-07-24 11:02:22.719068
215	204	7	400000.00	2025-07-24 11:04:16.730912
216	205	8	0.00	2025-07-24 11:21:06.715169
217	206	7	400000.00	2025-07-24 11:21:42.040101
218	207	7	400000.00	2025-07-24 17:01:35.687564
219	208	7	400000.00	2025-07-25 01:47:14.629746
220	209	7	400000.00	2025-07-25 14:45:04.492418
221	210	7	400000.00	2025-07-25 15:42:53.613395
222	211	7	400000.00	2025-07-25 16:22:39.286507
223	212	7	400000.00	2025-07-25 16:36:05.325216
224	213	7	400000.00	2025-07-26 02:24:36.787472
225	214	7	400000.00	2025-07-26 02:56:15.838126
226	215	8	0.00	2025-07-26 04:44:01.021664
230	219	7	400000.00	2025-07-26 09:38:06.473371
231	220	7	400000.00	2025-07-26 09:49:42.838378
232	221	7	400000.00	2025-07-26 09:59:41.710769
233	222	7	400000.00	2025-07-26 10:03:57.182809
234	223	7	400000.00	2025-07-26 10:16:27.228662
235	224	7	400000.00	2025-07-26 13:40:44.354952
236	225	8	0.00	2025-07-26 13:43:32.192906
237	226	7	400000.00	2025-08-01 13:40:43.240849
238	227	7	400000.00	2025-08-04 15:10:23.318694
239	228	7	400000.00	2025-08-05 14:41:09.965855
240	229	7	400000.00	2025-08-05 14:42:20.788758
241	230	7	400000.00	2025-08-06 09:44:55.574708
242	231	7	400000.00	2025-08-06 09:49:51.482725
243	232	7	400000.00	2025-08-07 10:13:41.80002
244	233	7	400000.00	2025-08-08 12:23:10.511532
245	234	7	400000.00	2025-08-08 12:46:45.110491
246	235	7	400000.00	2025-08-08 12:49:12.53563
247	236	7	400000.00	2025-08-08 12:53:01.960069
248	238	7	400000.00	2025-08-08 16:38:12.282919
249	239	7	400000.00	2025-08-08 16:45:10.97825
250	240	7	400000.00	2025-08-08 16:57:13.334785
251	241	7	400000.00	2025-08-08 16:59:07.363572
252	242	7	400000.00	2025-08-08 17:05:43.149844
253	243	7	400000.00	2025-08-08 17:09:08.889836
254	244	7	400000.00	2025-08-08 17:12:21.661031
255	245	7	400000.00	2025-08-08 17:14:35.834623
256	246	8	0.00	2025-08-08 17:25:10.855764
257	247	8	0.00	2025-08-08 17:26:03.339023
258	248	8	0.00	2025-08-08 17:28:35.821598
259	249	7	400000.00	2025-08-14 04:14:12.731828
260	250	7	400000.00	2025-08-14 04:23:50.888105
261	251	7	400000.00	2025-08-14 04:30:10.160911
262	252	7	400000.00	2025-08-15 02:42:36.160778
263	253	7	400000.00	2025-08-19 03:35:16.345195
264	254	7	400000.00	2025-08-19 03:36:29.675463
265	255	7	400000.00	2025-08-19 03:44:12.930321
266	256	7	400000.00	2025-08-19 04:28:44.076324
267	257	7	400000.00	2025-08-19 04:32:21.030034
268	258	7	400000.00	2025-08-19 04:36:59.963777
269	259	7	400000.00	2025-08-19 04:40:59.132922
270	260	7	400000.00	2025-08-19 04:44:17.1089
271	261	7	400000.00	2025-08-19 04:48:54.502468
272	262	7	400000.00	2025-08-19 05:21:56.594544
273	263	7	400000.00	2025-08-19 12:09:35.162385
274	264	7	400000.00	2025-08-19 12:46:54.930172
275	265	7	400000.00	2025-08-19 13:01:33.58631
276	266	7	400000.00	2025-08-21 05:47:30.28616
277	267	7	400000.00	2025-08-21 05:57:45.610837
278	268	8	0.00	2025-08-22 06:38:50.656294
279	269	7	400000.00	2025-08-22 07:12:46.650283
280	270	7	400000.00	2025-08-22 07:30:04.363476
281	271	7	400000.00	2025-08-22 07:38:37.853764
282	272	7	400000.00	2025-08-22 07:40:38.444097
283	273	7	400000.00	2025-08-22 09:13:55.250438
284	274	7	400000.00	2025-08-23 02:23:38.168249
285	275	8	0.00	2025-08-23 05:15:52.716328
286	276	7	400000.00	2025-08-23 07:42:57.289631
287	277	7	400000.00	2025-08-25 02:50:33.997424
288	278	7	400000.00	2025-08-25 08:54:16.66048
289	279	7	400000.00	2025-08-27 03:37:10.952277
290	280	7	400000.00	2025-08-28 03:20:12.700001
291	281	7	400000.00	2025-08-29 03:27:08.852481
292	282	8	0.00	2025-09-03 13:54:07.268489
293	283	8	0.00	2025-09-08 00:27:13.110535
294	284	8	0.00	2025-09-08 01:27:39.511934
295	285	9	0.00	2025-09-21 06:43:20.751117
296	286	9	0.00	2025-09-21 07:10:55.487511
297	287	9	0.00	2025-09-22 00:57:24.736375
298	288	9	0.00	2025-09-22 01:24:01.847911
299	289	9	0.00	2025-09-24 11:12:45.248407
300	290	8	0.00	2025-09-24 11:27:04.801278
301	291	9	0.00	2025-09-24 11:40:49.743691
302	292	7	400000.00	2025-09-30 07:20:02.942675
303	293	8	0.00	2025-10-04 08:50:06.45056
304	294	9	0.00	2025-10-06 08:20:36.223253
305	295	8	0.00	2025-10-06 08:23:13.453905
306	296	7	400000.00	2025-10-06 09:01:56.211862
307	297	7	400000.00	2025-10-06 09:13:00.95688
308	298	7	400000.00	2025-10-06 10:37:26.745677
309	299	7	400000.00	2025-10-07 02:07:04.972964
310	300	8	0.00	2025-10-07 02:10:07.038672
311	301	7	400000.00	2025-10-07 02:10:55.141095
312	302	7	400000.00	2025-10-07 02:35:44.441154
313	303	7	400000.00	2025-10-08 04:08:12.661834
314	304	9	0.00	2025-10-15 02:43:34.445858
315	305	8	0.00	2025-10-17 11:47:12.934011
316	306	9	0.00	2025-10-17 12:01:40.20961
317	307	8	0.00	2025-11-10 04:40:27.521408
318	308	7	400000.00	2025-12-24 05:15:01.6291
319	309	7	400000.00	2025-12-25 03:34:50.73018
320	310	8	0.00	2026-01-08 03:37:51.164416
321	311	7	400000.00	2026-01-29 05:16:27.195613
322	312	7	400000.00	2026-01-30 10:47:31.15661
323	313	7	400000.00	2026-02-11 09:35:20.843523
324	314	8	0.00	2026-02-19 08:59:53.88641
325	315	7	400000.00	2026-02-19 09:03:08.442679
326	316	9	0.00	2026-02-19 14:08:36.933233
327	317	9	0.00	2026-03-03 08:34:53.929996
328	318	7	400000.00	2026-03-26 05:41:01.588025
329	319	7	400000.00	2026-03-27 01:01:26.3762
330	320	7	400000.00	2026-03-27 01:09:40.912321
331	321	7	400000.00	2026-03-27 09:37:58.926915
332	322	7	400000.00	2026-03-27 09:46:40.631147
333	323	9	0.00	2026-03-27 09:48:19.45679
334	324	7	400000.00	2026-03-30 02:45:58.268758
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.orders (id, user_id, total_amount, status, payment_id, payment_status, created_at, updated_at, payment_method, paid_at, paid_amount) FROM stdin;
293	YO-DHnVAZRWG	0.00	completed	\N	pending	2025-10-04 08:50:06.392147	2025-10-04 08:50:06.392147	\N	\N	\N
227	IqO9IlNVqHch	400000.00	cancelled	order_227_1754320222858	expired	2025-08-04 15:10:23.257229	2025-08-04 15:10:29.411	\N	\N	\N
214	IqO9IlNVqHch	400000.00	cancelled	order_214_1753498575984	cancelled	2025-07-26 02:56:15.792711	2025-07-26 03:14:08.807	\N	\N	\N
215	IqO9IlNVqHch	0.00	completed	demo_payment_1753505041533_3pxwll650	demo_paid	2025-07-26 04:44:00.973211	2025-07-26 04:44:01.534	\N	\N	\N
190	IqO9IlNVqHch	400000.00	completed	midtrans_sim_190	paid	2025-07-24 09:12:14.142906	2025-07-24 09:13:35.795	\N	\N	\N
195	IqO9IlNVqHch	400000.00	completed	midtrans_sim_195	paid	2025-07-24 09:47:17.458765	2025-07-24 09:48:20.273	\N	\N	\N
198	qmTM5EUv-VeC	0.00	completed	demo_payment_1753351568975_xhg5bzdc7	demo_paid	2025-07-24 10:06:08.32953	2025-07-24 10:06:08.975	\N	\N	\N
201	IqO9IlNVqHch	400000.00	completed	midtrans_sim_201	paid	2025-07-24 10:47:10.51547	2025-07-24 10:48:32.402	\N	\N	\N
203	qmTM5EUv-VeC	400000.00	completed	midtrans_sim_203	paid	2025-07-24 11:02:22.672453	2025-07-24 11:03:11.394	\N	\N	\N
204	qmTM5EUv-VeC	400000.00	completed	midtrans_sim_204	paid	2025-07-24 11:04:16.682018	2025-07-24 11:05:05.798	\N	\N	\N
205	qmTM5EUv-VeC	0.00	completed	demo_payment_1753356067212_mefs03zd7	demo_paid	2025-07-24 11:21:06.667797	2025-07-24 11:21:07.212	\N	\N	\N
206	qmTM5EUv-VeC	400000.00	completed	midtrans_sim_206	paid	2025-07-24 11:21:41.991051	2025-07-24 11:26:14.172	\N	\N	\N
209	IqO9IlNVqHch	400000.00	cancelled	\N	failed	2025-07-25 14:45:04.427943	2025-07-25 15:36:30.9752	\N	\N	\N
211	IqO9IlNVqHch	400000.00	cancelled	order_211_1753460559511	cancelled	2025-07-25 16:22:39.192488	2025-07-25 16:30:50.900481	\N	\N	\N
212	IqO9IlNVqHch	400000.00	cancelled	order_212_1753461365435	cancelled	2025-07-25 16:36:05.276496	2025-07-25 16:47:37.728867	\N	\N	\N
210	IqO9IlNVqHch	400000.00	cancelled	order_210_1753458173795	cancelled	2025-07-25 15:42:53.558607	2025-07-25 16:52:20.377686	\N	\N	\N
208	IqO9IlNVqHch	400000.00	cancelled	cleanup_expired	expired	2025-07-25 01:47:14.570076	2025-07-26 02:41:07.939415	\N	\N	\N
207	IqO9IlNVqHch	400000.00	cancelled	cleanup_expired	expired	2025-07-24 17:01:35.617131	2025-07-26 02:41:07.981128	\N	\N	\N
200	IqO9IlNVqHch	400000.00	cancelled	cleanup_expired	expired	2025-07-24 10:18:27.69338	2025-07-26 02:41:08.022092	\N	\N	\N
196	IqO9IlNVqHch	400000.00	cancelled	cleanup_expired	expired	2025-07-24 10:01:05.494474	2025-07-26 02:41:08.063058	\N	\N	\N
194	IqO9IlNVqHch	400000.00	cancelled	cleanup_expired	expired	2025-07-24 09:23:00.712232	2025-07-26 02:41:08.103813	\N	\N	\N
193	IqO9IlNVqHch	400000.00	cancelled	cleanup_expired	expired	2025-07-24 09:21:52.946095	2025-07-26 02:41:08.144872	\N	\N	\N
192	IqO9IlNVqHch	400000.00	cancelled	cleanup_expired	expired	2025-07-24 09:17:20.866427	2025-07-26 02:41:08.186223	\N	\N	\N
189	IqO9IlNVqHch	400000.00	cancelled	cleanup_expired	expired	2025-07-24 09:10:24.969684	2025-07-26 02:41:08.227529	\N	\N	\N
188	IqO9IlNVqHch	400000.00	cancelled	cleanup_expired	expired	2025-07-24 09:09:41.324305	2025-07-26 02:41:08.268987	\N	\N	\N
213	IqO9IlNVqHch	400000.00	cancelled	order_213_1753496754988	not_found	2025-07-26 02:24:36.701425	2025-07-26 02:45:47.597791	\N	\N	\N
229	qmTM5EUv-VeC	400000.00	completed	midtrans_sim_229	paid	2025-08-05 14:42:20.738729	2025-08-05 14:44:03.837	\N	\N	\N
219	IqO9IlNVqHch	400000.00	cancelled	order_219_1753522687594	cancelled	2025-07-26 09:38:06.38457	2025-07-26 09:46:28.159	\N	\N	\N
220	IqO9IlNVqHch	400000.00	cancelled	order_220_1753523383949	cancelled	2025-07-26 09:49:42.794053	2025-07-26 09:54:25.459	\N	\N	\N
221	IqO9IlNVqHch	400000.00	cancelled	order_221_1753523982809	cancelled	2025-07-26 09:59:41.66415	2025-07-26 10:05:49.568	\N	\N	\N
222	IqO9IlNVqHch	400000.00	cancelled	order_222_1753524238275	cancelled	2025-07-26 10:03:57.135273	2025-07-26 10:06:13.389	\N	\N	\N
223	IqO9IlNVqHch	400000.00	cancelled	order_223_1753524988317	cancelled	2025-07-26 10:16:27.177024	2025-07-26 10:17:29.417	\N	\N	\N
224	IqO9IlNVqHch	400000.00	cancelled	order_224_1753537245258	cancelled	2025-07-26 13:40:44.307513	2025-07-26 13:42:53.023	\N	\N	\N
225	IqO9IlNVqHch	0.00	completed	demo_payment_1753537412715_hs2caouck	demo_paid	2025-07-26 13:43:32.145162	2025-07-26 13:43:32.715	\N	\N	\N
242	IqO9IlNVqHch	400000.00	cancelled	order_242_1754672743464	cancelled	2025-08-08 17:05:43.106044	2025-08-08 17:10:58.13	\N	\N	\N
186	qmTM5EUv-VeC	400000.00	cancelled	\N	expired	2025-07-24 09:05:32.604826	2025-07-24 09:05:32.604826	\N	\N	\N
187	qmTM5EUv-VeC	400000.00	cancelled	\N	expired	2025-07-24 09:06:03.187685	2025-07-24 09:06:03.187685	\N	\N	\N
191	qmTM5EUv-VeC	400000.00	cancelled	\N	expired	2025-07-24 09:14:50.208367	2025-07-24 09:14:50.208367	\N	\N	\N
197	qmTM5EUv-VeC	400000.00	cancelled	\N	expired	2025-07-24 10:05:27.114828	2025-07-24 10:05:27.114828	\N	\N	\N
199	qmTM5EUv-VeC	400000.00	cancelled	\N	expired	2025-07-24 10:06:45.977046	2025-07-24 10:06:45.977046	\N	\N	\N
202	qmTM5EUv-VeC	400000.00	cancelled	\N	expired	2025-07-24 10:52:57.758949	2025-07-24 10:52:57.758949	\N	\N	\N
226	IqO9IlNVqHch	400000.00	cancelled	order_226_1754055643936	expired	2025-08-01 13:40:43.077327	2025-08-01 13:40:47.863	\N	\N	\N
238	IqO9IlNVqHch	400000.00	cancelled	order_238_1754671092616	cancelled	2025-08-08 16:38:12.190765	2025-08-08 16:48:29.453	\N	\N	\N
233	IqO9IlNVqHch	400000.00	cancelled	order_233_1754655789423	cancelled	2025-08-08 12:23:10.448857	2025-08-08 12:24:27.667	\N	\N	\N
239	IqO9IlNVqHch	400000.00	cancelled	order_239_1754671511296	expired	2025-08-08 16:45:10.928533	2025-08-08 16:55:20.618024	\N	\N	\N
234	IqO9IlNVqHch	400000.00	cancelled	order_234_1754657204009	cancelled	2025-08-08 12:46:45.062069	2025-08-08 12:48:01.379	\N	\N	\N
243	IqO9IlNVqHch	400000.00	cancelled	order_243_1754672949181	cancelled	2025-08-08 17:09:08.845678	2025-08-08 17:11:07.794	\N	\N	\N
228	qmTM5EUv-VeC	400000.00	cancelled	order_228_1754404870222	expired	2025-08-05 14:41:09.901055	2025-08-05 14:41:15.624	\N	\N	\N
230	qmTM5EUv-VeC	400000.00	cancelled	order_230_1754473495831	expired	2025-08-06 09:44:55.502426	2025-08-06 09:45:02.258	\N	\N	\N
231	qmTM5EUv-VeC	400000.00	cancelled	order_231_1754473791727	expired	2025-08-06 09:49:51.434305	2025-08-06 09:49:55.278	\N	\N	\N
232	IqO9IlNVqHch	400000.00	cancelled	order_232_1754561615446	expired	2025-08-07 10:13:41.735661	2025-08-07 10:13:54.388	\N	\N	\N
235	IqO9IlNVqHch	400000.00	cancelled	order_235_1754657351407	expired	2025-08-08 12:49:12.488419	2025-08-08 12:50:13.422	\N	\N	\N
236	qmTM5EUv-VeC	400000.00	cancelled	order_236_1754657582210	expired	2025-08-08 12:53:01.911627	2025-08-08 12:53:10.643	\N	\N	\N
240	IqO9IlNVqHch	400000.00	cancelled	order_240_1754672233638	expired	2025-08-08 16:57:13.288491	2025-08-08 16:58:13.348	\N	\N	\N
241	IqO9IlNVqHch	400000.00	cancelled	order_241_1754672347661	expired	2025-08-08 16:59:07.318548	2025-08-08 17:00:08.39	\N	\N	\N
248	IqO9IlNVqHch	0.00	cancelled	order_248_1754674115773	expired	2025-08-08 17:28:35.773443	2025-08-08 17:29:38.778	\N	\N	\N
244	IqO9IlNVqHch	400000.00	cancelled	order_244_1754673141946	expired	2025-08-08 17:12:21.616902	2025-08-08 17:13:22.85	\N	\N	\N
246	IqO9IlNVqHch	0.00	cancelled	order_246_1754673910806	expired	2025-08-08 17:25:10.806615	2025-08-08 17:26:14.234	\N	\N	\N
245	IqO9IlNVqHch	400000.00	cancelled	order_245_1754673276115	expired	2025-08-08 17:14:35.788672	2025-08-08 17:15:37.889	\N	\N	\N
247	IqO9IlNVqHch	0.00	cancelled	order_247_1754673963290	expired	2025-08-08 17:26:03.290146	2025-08-08 17:27:04.078	\N	\N	\N
249	IqO9IlNVqHch	400000.00	cancelled	order_249_1755144851729	expired	2025-08-14 04:14:12.644563	2025-08-14 04:15:16.43	\N	\N	\N
250	IqO9IlNVqHch	400000.00	cancelled	order_250_1755145429823	expired	2025-08-14 04:23:50.839793	2025-08-14 04:24:52.431	\N	\N	\N
251	IqO9IlNVqHch	400000.00	cancelled	order_251_1755145809098	expired	2025-08-14 04:30:10.11053	2025-08-14 04:31:10.667	\N	\N	\N
252	IqO9IlNVqHch	400000.00	cancelled	order_252_1755225756396	expired	2025-08-15 02:42:36.096297	2025-08-15 02:43:39.151	\N	\N	\N
253	IqO9IlNVqHch	400000.00	cancelled	order_253_1755574517371	expired	2025-08-19 03:35:16.286014	2025-08-19 03:36:17.71	\N	\N	\N
254	IqO9IlNVqHch	400000.00	cancelled	order_254_1755574590717	expired	2025-08-19 03:36:29.630626	2025-08-19 03:37:31.862	\N	\N	\N
255	IqO9IlNVqHch	400000.00	cancelled	order_255_1755575053931	expired	2025-08-19 03:44:12.887795	2025-08-19 03:45:12.915	\N	\N	\N
256	IqO9IlNVqHch	400000.00	cancelled	order_256_1755577725031	expired	2025-08-19 04:28:44.033265	2025-08-19 04:29:47.173	\N	\N	\N
257	IqO9IlNVqHch	400000.00	cancelled	order_257_1755577941991	expired	2025-08-19 04:32:20.986609	2025-08-19 04:33:24.041	\N	\N	\N
294	Zqr6APIHPrjp	0.00	completed	\N	pending	2025-10-06 08:20:36.164231	2025-10-06 08:20:36.164231	\N	\N	\N
258	IqO9IlNVqHch	400000.00	cancelled	order_258_1755578220911	expired	2025-08-19 04:36:59.853762	2025-08-19 04:38:03.788	\N	\N	\N
295	Zqr6APIHPrjp	0.00	completed	\N	pending	2025-10-06 08:23:13.40781	2025-10-06 08:23:13.40781	\N	\N	\N
259	IqO9IlNVqHch	400000.00	cancelled	order_259_1755578460078	expired	2025-08-19 04:40:59.088648	2025-08-19 04:41:59.27	\N	\N	\N
297	admin	400000.00	completed	\N	pending	2025-10-06 09:13:00.91093	2025-10-06 09:13:00.91093	\N	\N	\N
298	Zqr6APIHPrjp	400000.00	completed	\N	pending	2025-10-06 10:37:26.697215	2025-10-06 10:37:26.697215	\N	\N	\N
260	IqO9IlNVqHch	400000.00	cancelled	order_260_1755578658046	expired	2025-08-19 04:44:17.066081	2025-08-19 04:45:17.855	\N	\N	\N
302	T1gm3pG2h_o0	400000.00	completed	\N	pending	2025-10-07 02:35:44.392848	2025-10-07 02:35:44.392848	\N	\N	\N
306	JMGk2hu71-ZQ	0.00	completed	\N	pending	2025-10-17 12:01:40.162121	2025-10-17 12:01:40.162121	\N	\N	\N
261	IqO9IlNVqHch	400000.00	cancelled	order_261_1755578937188	expired	2025-08-19 04:48:54.442365	2025-08-19 04:50:00.274	\N	\N	\N
264	IqO9IlNVqHch	400000.00	cancelled	order_264_1755607616185	expired	2025-08-19 12:46:54.88676	2025-08-19 12:47:55.354	\N	\N	\N
320	d_g-3GaM0rMl	400000.00	cancelled	order_320_1774573780823	expired	2026-03-27 01:09:40.863737	2026-03-27 01:10:44.937	\N	\N	\N
323	d_g-3GaM0rMl	0.00	completed	\N	pending	2026-03-27 09:48:19.409812	2026-03-27 09:48:19.409812	\N	\N	\N
262	IqO9IlNVqHch	400000.00	cancelled	order_262_1755580917504	expired	2025-08-19 05:21:56.55116	2025-08-19 05:22:56.796	\N	\N	\N
292	IqO9IlNVqHch	400000.00	cancelled	order_292_1759216803212	expired	2025-09-30 07:20:02.877664	2025-09-30 07:21:02.995	\N	\N	\N
263	IqO9IlNVqHch	400000.00	cancelled	order_263_1755605374764	expired	2025-08-19 12:09:35.117213	2025-08-19 12:10:35.899	\N	\N	\N
265	IqO9IlNVqHch	400000.00	cancelled	order_265_1755608494830	expired	2025-08-19 13:01:33.543057	2025-08-19 13:02:35.83	\N	\N	\N
266	IqO9IlNVqHch	400000.00	cancelled	order_266_1755755249839	expired	2025-08-21 05:47:30.199196	2025-08-21 05:48:30.369	\N	\N	\N
296	Zqr6APIHPrjp	400000.00	cancelled	order_296_1759741317177	expired	2025-10-06 09:01:56.160368	2025-10-06 09:02:58.881	\N	\N	\N
299	90IRpTsRLVfE	400000.00	completed	\N	pending	2025-10-07 02:07:04.895366	2025-10-07 02:07:04.895366	\N	\N	\N
267	IqO9IlNVqHch	400000.00	cancelled	order_267_1755755865148	expired	2025-08-21 05:57:45.561058	2025-08-21 05:58:47.412	\N	\N	\N
268	LVoRx5kxy1hx	0.00	completed	\N	pending	2025-08-22 06:38:50.601637	2025-08-22 06:38:50.601637	\N	\N	\N
269	IqO9IlNVqHch	400000.00	cancelled	order_269_1755846766602	expired	2025-08-22 07:12:46.602036	2025-08-22 07:13:50.985	\N	\N	\N
270	IqO9IlNVqHch	400000.00	cancelled	order_270_1755847804318	expired	2025-08-22 07:30:04.318102	2025-08-22 07:31:07.983	\N	\N	\N
300	9wZHAapaLS1o	0.00	completed	\N	pending	2025-10-07 02:10:06.990343	2025-10-07 02:10:06.990343	\N	\N	\N
271	IqO9IlNVqHch	400000.00	cancelled	order_271_1755848317809	expired	2025-08-22 07:38:37.809565	2025-08-22 07:39:38.423	\N	\N	\N
301	Nz0YaiuDTaoH	400000.00	completed	\N	pending	2025-10-07 02:10:55.093377	2025-10-07 02:10:55.093377	\N	\N	\N
272	IqO9IlNVqHch	400000.00	cancelled	order_272_1755848438562	expired	2025-08-22 07:40:38.39762	2025-08-22 07:41:38.428	\N	\N	\N
273	IqO9IlNVqHch	400000.00	cancelled	order_273_1755854035201	expired	2025-08-22 09:13:55.201061	2025-08-22 09:14:57.283	\N	\N	\N
303	9wZHAapaLS1o	400000.00	completed	\N	pending	2025-10-08 04:08:12.599307	2025-10-08 04:08:12.599307	\N	\N	\N
274	LVoRx5kxy1hx	400000.00	completed	order_274_1755915818490	paid	2025-08-23 02:23:38.121131	2025-08-23 02:29:02.38	\N	\N	\N
275	90IRpTsRLVfE	0.00	completed	\N	pending	2025-08-23 05:15:52.668153	2025-08-23 05:15:52.668153	\N	\N	\N
304	MNWv_X5sPskg	0.00	completed	\N	pending	2025-10-15 02:43:34.389295	2025-10-15 02:43:34.389295	\N	\N	\N
276	IqO9IlNVqHch	400000.00	cancelled	order_276_1755934956589	expired	2025-08-23 07:42:57.112508	2025-08-23 07:43:57.767	\N	\N	\N
305	JMGk2hu71-ZQ	0.00	completed	\N	pending	2025-10-17 11:47:12.871054	2025-10-17 11:47:12.871054	\N	\N	\N
277	IqO9IlNVqHch	400000.00	cancelled	order_277_1756090234023	expired	2025-08-25 02:50:33.936336	2025-08-25 02:51:36.567	\N	\N	\N
307	L1lAu8xHPJE8	0.00	completed	\N	pending	2025-11-10 04:40:27.462813	2025-11-10 04:40:27.462813	\N	\N	\N
308	BjD746rJqX8B	400000.00	completed	\N	pending	2025-12-24 05:15:01.471444	2025-12-24 05:15:01.471444	\N	\N	\N
278	90IRpTsRLVfE	400000.00	cancelled	order_278_1756112056971	expired	2025-08-25 08:54:16.612756	2025-08-25 08:55:16.759	\N	\N	\N
309	X56CUJqS8IV6	400000.00	completed	\N	pending	2025-12-25 03:34:50.674426	2025-12-25 03:34:50.674426	\N	\N	\N
279	IqO9IlNVqHch	400000.00	cancelled	order_279_1756265831070	expired	2025-08-27 03:37:10.895654	2025-08-27 03:38:14.159	\N	\N	\N
310	fuXBqzQ0mOV4	0.00	completed	\N	pending	2026-01-08 03:37:51.013421	2026-01-08 03:37:51.013421	\N	\N	\N
280	IqO9IlNVqHch	400000.00	cancelled	order_280_1756351212888	expired	2025-08-28 03:20:12.642585	2025-08-28 03:21:13.56	\N	\N	\N
311	P0ZIeq09aNG-	400000.00	completed	\N	pending	2026-01-29 05:16:27.139377	2026-01-29 05:16:27.139377	\N	\N	\N
281	IqO9IlNVqHch	400000.00	cancelled	order_281_1756438027284	expired	2025-08-29 03:27:08.793657	2025-08-29 03:28:13.789	\N	\N	\N
282	TvCd1ViqqEfE	0.00	completed	\N	pending	2025-09-03 13:54:07.203886	2025-09-03 13:54:07.203886	\N	\N	\N
283	wJCU6NoZ5-PA	0.00	completed	\N	pending	2025-09-08 00:27:13.055225	2025-09-08 00:27:13.055225	\N	\N	\N
284	90J9vQQbOwmG	0.00	completed	\N	pending	2025-09-08 01:27:39.463008	2025-09-08 01:27:39.463008	\N	\N	\N
285	IqO9IlNVqHch	0.00	completed	\N	pending	2025-09-21 06:43:20.700139	2025-09-21 06:43:20.700139	\N	\N	\N
286	qmTM5EUv-VeC	0.00	completed	\N	pending	2025-09-21 07:10:55.440005	2025-09-21 07:10:55.440005	\N	\N	\N
287	90IRpTsRLVfE	0.00	completed	\N	pending	2025-09-22 00:57:24.682242	2025-09-22 00:57:24.682242	\N	\N	\N
288	i9i4_VwSRTck	0.00	completed	\N	pending	2025-09-22 01:24:01.795544	2025-09-22 01:24:01.795544	\N	\N	\N
289	1LW9p5YZYUbW	0.00	completed	\N	pending	2025-09-24 11:12:45.191399	2025-09-24 11:12:45.191399	\N	\N	\N
290	1LW9p5YZYUbW	0.00	completed	\N	pending	2025-09-24 11:27:04.750083	2025-09-24 11:27:04.750083	\N	\N	\N
291	jKRKMaDheZIH	0.00	completed	\N	pending	2025-09-24 11:40:49.693409	2025-09-24 11:40:49.693409	\N	\N	\N
312	nyc8-QmerUlh	400000.00	completed	\N	pending	2026-01-30 10:47:31.102484	2026-01-30 10:47:31.102484	\N	\N	\N
313	kZzxpJ0CVEgI	400000.00	completed	\N	pending	2026-02-11 09:35:20.771518	2026-02-11 09:35:20.771518	\N	\N	\N
314	aCBnJE-nuzqq	0.00	completed	\N	pending	2026-02-19 08:59:53.818416	2026-02-19 08:59:53.818416	\N	\N	\N
315	aCBnJE-nuzqq	400000.00	completed	\N	pending	2026-02-19 09:03:08.383695	2026-02-19 09:03:08.383695	\N	\N	\N
316	aCBnJE-nuzqq	0.00	completed	\N	pending	2026-02-19 14:08:36.85546	2026-02-19 14:08:36.85546	\N	\N	\N
317	s6tQ4RrnS1HM	0.00	completed	\N	pending	2026-03-03 08:34:53.857578	2026-03-03 08:34:53.857578	\N	\N	\N
318	ILNui9BbubDL	400000.00	completed	\N	pending	2026-03-26 05:41:01.514998	2026-03-26 05:41:01.514998	\N	\N	\N
319	d_g-3GaM0rMl	400000.00	cancelled	order_319_1774573286310	expired	2026-03-27 01:01:26.312875	2026-03-27 01:02:29.574	\N	\N	\N
321	yBqNeMDOpVxn	400000.00	completed	\N	pending	2026-03-27 09:37:58.869935	2026-03-27 09:37:58.869935	\N	\N	\N
322	d_g-3GaM0rMl	400000.00	cancelled	order_322_1774604801217	expired	2026-03-27 09:46:40.582228	2026-03-27 09:47:43.196	\N	\N	\N
324	38uyQgQLGMt3	400000.00	completed	\N	pending	2026-03-30 02:45:58.197353	2026-03-30 02:45:58.197353	\N	\N	\N
\.


--
-- Data for Name: otp_verifications; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.otp_verifications (id, email, otp, purpose, expires_at, used, created_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.sessions (sid, sess, expire) FROM stdin;
a8TH6briXXU18AnX4DpiIs7JzVjJiLmJ	{"user": {"email": "marchoferdiansalim@gmail.com", "userId": "ILNui9BbubDL", "lastName": "Isvara Aiko", "firstName": "Aruna", "loginTime": "2026-03-26T05:40:20.310Z", "authProvider": "custom"}, "cookie": {"path": "/", "secure": true, "expires": "2026-04-02T05:40:20.311Z", "httpOnly": true, "originalMaxAge": 604800000}}	2026-04-02 05:40:21
IQ9hb1fgJPV9WHVtL1PAUbgyeRJd25s1	{"user": {"email": "fathimahazzahra.work@gmail.com", "userId": "d_g-3GaM0rMl", "lastName": "Rakhman", "firstName": "Fathimah", "loginTime": "2026-03-27T01:00:10.032Z", "authProvider": "custom"}, "cookie": {"path": "/", "secure": true, "expires": "2026-04-03T01:00:10.032Z", "httpOnly": true, "originalMaxAge": 604800000}}	2026-04-03 01:00:11
HLkkOOUD4Hgn7GD6ceIrI1F3bDNAPc3H	{"user": {"email": "marchoferdiansalim@gmail.com", "userId": "ILNui9BbubDL", "lastName": "Isvara Aiko", "firstName": "Aruna", "loginTime": "2026-03-27T03:23:49.862Z", "authProvider": "custom"}, "cookie": {"path": "/", "secure": true, "expires": "2026-04-03T03:23:49.863Z", "httpOnly": true, "originalMaxAge": 604800000}}	2026-04-03 03:23:50
Fo3kFoepThOfh7bBtVVrHeDocbRnv9Ad	{"user": {"email": "goldennovember95@gmail.com", "userId": "yBqNeMDOpVxn", "lastName": "Pramusita", "firstName": "Anggita", "loginTime": "2026-03-27T09:37:44.871Z", "authProvider": "custom"}, "cookie": {"path": "/", "secure": true, "expires": "2026-04-03T09:37:44.871Z", "httpOnly": true, "originalMaxAge": 604800000}}	2026-04-03 09:37:45
gfvjDUeh_BguMsPEL51Mm4SA8nN7tNfE	{"user": {"email": "apramusita@gmail.com", "userId": "OXrbvlmzEmhd", "lastName": "Pramusita", "firstName": "Anggita", "loginTime": "2026-03-28T01:05:16.930Z", "authProvider": "custom"}, "cookie": {"path": "/", "secure": true, "expires": "2026-04-04T01:05:16.930Z", "httpOnly": true, "originalMaxAge": 604800000}}	2026-04-04 01:05:17
oDOyKhnzcmlkAzkVI7go0Grto7oaIk18	{"user": {"email": "fita.meriana@gmail.com", "userId": "38uyQgQLGMt3", "lastName": "Marinka Hutomo", "firstName": "Nathissa", "loginTime": "2026-03-30T01:26:50.797Z", "authProvider": "custom"}, "cookie": {"path": "/", "secure": true, "expires": "2026-04-06T01:26:50.797Z", "httpOnly": true, "originalMaxAge": 604800000}}	2026-04-06 01:26:51
LR6j_QQNxVvztr8acRjbJCmagrh1rOQH	{"user": {"email": "fita.meriana@gmail.com", "userId": "38uyQgQLGMt3", "lastName": "Marinka Hutomo", "firstName": "Nathissa", "loginTime": "2026-03-30T02:43:13.448Z", "authProvider": "custom"}, "cookie": {"path": "/", "secure": true, "expires": "2026-04-06T02:43:13.448Z", "httpOnly": true, "originalMaxAge": 604800000}}	2026-04-06 02:43:14
U_rAGmLMREuafDDhlPODwG1WPqIA-kyS	{"user": {"email": "goldennovember95@gmail.com", "userId": "yBqNeMDOpVxn", "lastName": "Pramusita", "firstName": "Anggita", "loginTime": "2026-03-27T02:09:31.831Z", "authProvider": "custom"}, "cookie": {"path": "/", "secure": true, "expires": "2026-04-03T02:09:31.831Z", "httpOnly": true, "originalMaxAge": 604800000}}	2026-04-03 02:09:32
DTyCP0ZRs7xpg9uN4KvyBZfGGeSsueki	{"user": {"email": "fita.meriana@gmail.com", "userId": "38uyQgQLGMt3", "lastName": "Marinka Hutomo", "firstName": "Nathissa", "loginTime": "2026-03-27T03:28:04.099Z", "authProvider": "custom"}, "cookie": {"path": "/", "secure": true, "expires": "2026-04-03T03:28:04.100Z", "httpOnly": true, "originalMaxAge": 604800000}}	2026-04-03 03:28:05
XK0aOwp4Q4USeohP7kDAWq00ClxgXi3n	{"user": {"email": "firmanyudhiarto21@gmail.com", "userId": "aCBnJE-nuzqq", "lastName": "Citra Kirania", "firstName": "Aleena", "loginTime": "2026-03-28T01:32:42.501Z", "authProvider": "custom"}, "cookie": {"path": "/", "secure": true, "expires": "2026-04-04T01:32:42.501Z", "httpOnly": true, "originalMaxAge": 604800000}}	2026-04-04 01:32:43
\.


--
-- Data for Name: user_assessments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.user_assessments (id, user_id, assessment_id, order_id, status, results, completed_at, created_at) FROM stdin;
102	IqO9IlNVqHch	7	190	completed	{"patterns": {"A": "typical", "B": "typical", "C": "typical", "D": "typical", "E": "typical", "F": "typical", "G": "typical", "H": "typical", "I": "typical", "J": "hypersensitive", "K": "typical", "L": "typical"}, "responses": {"1": "4", "2": "3", "3": "2", "4": "4", "5": "1", "7": "2", "8": "3", "9": "3", "10": "3", "11": "4", "12": "4", "13": "5", "14": "3", "15": "5", "16": "4", "17": "3", "18": "2", "19": "4", "20": "5", "21": "4", "22": "5", "23": "4", "24": "3", "25": "5", "26": "4", "27": "3", "28": "2", "29": "4", "30": "5", "31": "4", "32": "5", "33": "3", "34": "4", "35": "3", "36": "5", "37": "4", "38": "4", "39": "5", "40": "4", "41": "3", "42": "2", "43": "4", "44": "3", "45": "2", "46": "4", "47": "5", "48": "4", "49": "3", "50": "2", "51": "3", "52": "2", "53": "4", "54": "5", "55": "4", "56": "3", "57": "5", "58": "3", "59": "2", "60": "5", "61": "4", "62": "3", "63": "2", "64": "5", "65": "4", "66": "3", "67": "2", "68": "5", "69": "4", "70": "3", "71": "3", "72": "5", "73": "4", "74": "3", "75": "2", "76": "4", "77": "3", "78": "4", "79": "5", "80": "3", "81": "3", "82": "4", "83": "3", "84": "4", "85": "3", "86": "5", "87": "4", "88": "3", "89": "3", "90": "3", "91": "4", "92": "4", "93": "5", "94": "3", "95": "4", "96": "3", "97": "2", "98": "5", "99": "4", "100": "3", "101": "4", "102": "5", "103": "4", "104": "3", "105": "4", "106": "3", "107": "5", "108": "4", "109": "3", "110": "5", "111": "4", "112": "3", "113": "3", "114": "2", "115": "2", "116": "4", "117": "3", "118": "2", "119": "5", "120": "4", "121": "3", "122": "2", "123": "4", "124": "3", "125": "4"}, "totalScore": 443, "completedAt": "2025-07-25T13:33:30.399Z", "averageScore": "3.57", "sectionScores": {"A": {"count": 7, "total": 19, "average": "2.71"}, "B": {"count": 9, "total": 34, "average": "3.78"}, "C": {"count": 11, "total": 41, "average": "3.73"}, "D": {"count": 18, "total": 68, "average": "3.78"}, "E": {"count": 7, "total": 23, "average": "3.29"}, "F": {"count": 12, "total": 45, "average": "3.75"}, "G": {"count": 9, "total": 32, "average": "3.56"}, "H": {"count": 10, "total": 35, "average": "3.50"}, "I": {"count": 7, "total": 25, "average": "3.57"}, "J": {"count": 4, "total": 16, "average": "4.00"}, "K": {"count": 4, "total": 14, "average": "3.50"}, "L": {"count": 26, "total": 91, "average": "3.50"}}, "totalResponses": 124, "participantInfo": {"testDate": "2025-07-25", "childName": "Anastasia", "parentName": "Tommy", "relationship": "Ayah", "childBirthDate": "2015-01-01"}}	2025-07-25 13:33:30.399	2025-07-24 09:13:35.942262
141	L1lAu8xHPJE8	8	307	completed	{"responses": {"1": "kinestetik", "2": "visual", "3": "kinestetik", "4": "auditori", "5": "auditori", "6": "visual", "7": "visual", "8": "visual", "9": "auditori", "10": "auditori", "11": "kinestetik", "12": "auditori", "13": "visual", "14": "kinestetik"}, "completedAt": "2025-11-10T04:44:48.948Z", "percentages": {"visual": "35.7", "auditori": "35.7", "kinestetik": "28.6"}, "styleScores": {"visual": 5, "auditori": 5, "kinestetik": 4}, "primaryStyle": "auditori", "totalResponses": 14, "participantInfo": {}}	2025-11-10 04:44:48.948	2025-11-10 04:40:27.575499
142	BjD746rJqX8B	7	308	purchased	\N	\N	2025-12-24 05:15:01.681259
143	X56CUJqS8IV6	7	309	purchased	\N	\N	2025-12-25 03:34:50.781768
112	IqO9IlNVqHch	8	215	completed	{"responses": {"1": "auditori", "2": "auditori", "3": "auditori", "4": "auditori", "5": "visual", "6": "visual", "7": "auditori", "8": "visual", "9": "auditori", "10": "visual", "11": "auditori", "12": "visual", "13": "auditori", "14": "visual"}, "completedAt": "2025-09-21T07:46:44.072Z", "percentages": {"visual": "42.9", "auditori": "57.1", "kinestetik": "0.0"}, "styleScores": {"visual": 6, "auditori": 8, "kinestetik": 0}, "primaryStyle": "auditori", "totalResponses": 14, "participantInfo": {}}	2025-09-21 07:46:44.072	2025-07-26 04:44:01.60657
120	90J9vQQbOwmG	8	284	completed	{"responses": {"1": "kinestetik", "2": "visual", "3": "auditori", "4": "visual", "5": "visual", "6": "visual", "7": "auditori", "8": "auditori", "9": "visual", "10": "visual", "11": "visual", "12": "visual", "13": "auditori", "14": "visual"}, "completedAt": "2025-09-08T01:35:37.358Z", "percentages": {"visual": "64.3", "auditori": "28.6", "kinestetik": "7.1"}, "styleScores": {"visual": 9, "auditori": 4, "kinestetik": 1}, "primaryStyle": "visual", "totalResponses": 14, "participantInfo": {}}	2025-09-08 01:35:37.359	2025-09-08 01:27:39.559285
108	qmTM5EUv-VeC	8	205	completed	{"responses": {"1": "visual", "2": "visual", "3": "visual", "4": "visual", "5": "visual", "6": "visual", "7": "visual", "8": "visual", "9": "visual", "10": "visual", "11": "visual", "12": "visual", "13": "visual", "14": "visual"}, "completedAt": "2025-09-21T07:10:16.689Z", "percentages": {"visual": "100.0", "auditori": "0.0", "kinestetik": "0.0"}, "styleScores": {"visual": 14, "auditori": 0, "kinestetik": 0}, "primaryStyle": "visual", "totalResponses": 14, "participantInfo": {}}	2025-09-21 07:10:16.689	2025-07-24 11:21:07.279429
144	fuXBqzQ0mOV4	8	310	completed	{"responses": {"1": "kinestetik", "2": "visual", "3": "visual", "4": "visual", "5": "auditori", "6": "visual", "7": "kinestetik", "8": "auditori", "9": "visual", "10": "visual", "11": "visual", "12": "visual", "13": "visual", "14": "visual"}, "completedAt": "2026-01-08T03:40:38.013Z", "percentages": {"visual": "71.4", "auditori": "14.3", "kinestetik": "14.3"}, "styleScores": {"visual": 10, "auditori": 2, "kinestetik": 2}, "primaryStyle": "visual", "totalResponses": 14, "participantInfo": {}}	2026-01-08 03:40:38.013	2026-01-08 03:37:51.218906
107	qmTM5EUv-VeC	7	204	available	\N	\N	2025-07-24 11:05:05.918171
105	IqO9IlNVqHch	7	201	completed	{"patterns": {"A": "typical", "B": "typical", "C": "typical", "D": "typical", "E": "typical", "F": "typical", "G": "typical", "H": "typical", "I": "typical", "J": "typical", "K": "typical", "L": "typical"}, "responses": {"1": "3", "2": "3", "3": "3", "4": "2", "5": "3", "6": "3", "7": "3", "8": "2", "9": "4", "10": "3", "11": "4", "12": "3", "13": "2", "14": "4", "15": "3", "16": "2", "17": "4", "18": "5", "19": "4", "20": "3", "21": "4", "22": "3", "23": "2", "24": "1", "25": "4", "26": "3", "27": "2", "28": "3", "29": "2", "30": "4", "31": "4", "32": "3", "33": "2", "34": "5", "35": "4", "36": "3", "37": "5", "38": "4", "39": "3", "40": "2", "41": "2", "42": "3", "43": "4", "44": "3", "45": "3", "46": "3", "47": "3", "48": "2", "49": "4", "50": "4", "51": "3", "52": "4", "53": "3", "54": "3", "55": "3", "56": "4", "57": "2", "58": "3", "59": "4", "60": "2", "61": "3", "62": "3", "63": "2", "64": "2", "65": "4", "66": "3", "67": "3", "68": "2", "69": "3", "70": "4", "71": "3", "72": "4", "73": "3", "74": "2", "75": "3", "76": "5", "77": "4", "78": "3", "79": "3", "80": "4", "81": "3", "82": "4", "83": "3", "84": "4", "85": "3", "86": "5", "87": "4", "88": "3", "89": "2", "90": "1", "91": "4", "92": "3", "93": "4", "94": "3", "95": "4", "96": "3", "97": "4", "98": "3", "99": "2", "100": "2", "101": "4", "102": "3", "103": "4", "104": "3", "105": "5", "106": "4", "107": "3", "108": "4", "109": "4", "110": "5", "111": "4", "112": "3", "113": "4", "114": "3", "115": "4", "116": "3", "117": "4", "118": "3", "119": "4", "120": "3", "121": "4", "122": "3", "123": "3", "124": "4", "125": "3"}, "totalScore": 406, "completedAt": "2025-07-25T13:16:30.841Z", "averageScore": "3.25", "sectionScores": {"A": {"count": 8, "total": 22, "average": "2.75"}, "B": {"count": 9, "total": 29, "average": "3.22"}, "C": {"count": 11, "total": 34, "average": "3.09"}, "D": {"count": 18, "total": 59, "average": "3.28"}, "E": {"count": 7, "total": 23, "average": "3.29"}, "F": {"count": 12, "total": 35, "average": "2.92"}, "G": {"count": 9, "total": 27, "average": "3.00"}, "H": {"count": 10, "total": 36, "average": "3.60"}, "I": {"count": 7, "total": 22, "average": "3.14"}, "J": {"count": 4, "total": 14, "average": "3.50"}, "K": {"count": 4, "total": 12, "average": "3.00"}, "L": {"count": 26, "total": 93, "average": "3.58"}}, "totalResponses": 125, "participantInfo": {"testDate": "2025-07-24", "childName": "Tasya", "parentName": "Tommy", "relationship": "Ayah", "childBirthDate": "2014-07-01"}}	2025-07-25 13:16:30.841	2025-07-24 10:48:32.51601
123	90IRpTsRLVfE	9	287	purchased	\N	\N	2025-09-22 00:57:24.787575
128	YO-DHnVAZRWG	8	293	purchased	\N	\N	2025-10-04 08:50:06.505808
106	qmTM5EUv-VeC	7	203	available	\N	\N	2025-07-24 11:03:11.507676
126	1LW9p5YZYUbW	8	290	completed	{"responses": {"1": "visual", "2": "kinestetik", "3": "kinestetik", "4": "kinestetik", "5": "kinestetik", "6": "kinestetik", "7": "kinestetik", "8": "kinestetik", "9": "kinestetik", "10": "kinestetik", "11": "kinestetik", "12": "kinestetik", "13": "kinestetik", "14": "kinestetik"}, "completedAt": "2025-09-24T11:36:54.199Z", "percentages": {"visual": "7.1", "auditori": "0.0", "kinestetik": "92.9"}, "styleScores": {"visual": 1, "auditori": 0, "kinestetik": 13}, "primaryStyle": "kinestetik", "totalResponses": 14, "participantInfo": {}}	2025-09-24 11:36:54.199	2025-09-24 11:27:04.849902
129	Zqr6APIHPrjp	9	294	completed	{"ranking": [{"name": "Kinestetik", "score": 8, "total": 10, "category": "kinestetik", "percentage": 80}, {"name": "Interpersonal", "score": 8, "total": 10, "category": "interpersonal", "percentage": 80}, {"name": "Visual Spasial", "score": 7, "total": 10, "category": "visual_spasial", "percentage": 70}, {"name": "Musik", "score": 7, "total": 10, "category": "musik", "percentage": 70}, {"name": "Intrapersonal", "score": 7, "total": 10, "category": "intrapersonal", "percentage": 70}, {"name": "Linguistik", "score": 6, "total": 10, "category": "linguistik", "percentage": 60}, {"name": "Logis Matematis", "score": 6, "total": 10, "category": "logis_matematis", "percentage": 60}], "responses": {"1": true, "2": false, "3": true, "4": false, "5": true, "6": true, "7": true, "8": false, "9": true, "10": true, "11": true, "12": false, "13": true, "14": false, "15": true, "16": true, "17": false, "18": true, "19": false, "20": true, "21": false, "22": true, "23": false, "24": true, "25": true, "26": false, "27": true, "28": true, "29": true, "30": false, "31": true, "32": true, "33": true, "34": true, "35": true, "36": false, "37": true, "38": true, "39": true, "40": false, "41": true, "42": true, "43": true, "44": true, "45": true, "46": true, "47": true, "48": false, "49": false, "50": false, "51": false, "52": true, "53": true, "54": true, "55": true, "56": true, "57": false, "58": true, "59": true, "60": true, "61": true, "62": true, "63": true, "64": true, "65": true, "66": true, "67": true, "68": false, "69": false, "70": false}, "completedAt": "2025-10-06T09:00:43.703Z", "percentages": {"musik": 70, "kinestetik": 80, "linguistik": 60, "interpersonal": 80, "intrapersonal": 70, "visual_spasial": 70, "logis_matematis": 60}, "categoryScores": [{"name": "Kinestetik", "score": 8, "total": 10, "category": "kinestetik", "percentage": 80}, {"name": "Interpersonal", "score": 8, "total": 10, "category": "interpersonal", "percentage": 80}, {"name": "Visual Spasial", "score": 7, "total": 10, "category": "visual_spasial", "percentage": 70}, {"name": "Musik", "score": 7, "total": 10, "category": "musik", "percentage": 70}, {"name": "Intrapersonal", "score": 7, "total": 10, "category": "intrapersonal", "percentage": 70}, {"name": "Linguistik", "score": 6, "total": 10, "category": "linguistik", "percentage": 60}, {"name": "Logis Matematis", "score": 6, "total": 10, "category": "logis_matematis", "percentage": 60}], "participantInfo": {}, "scoresByCategory": {"musik": {"score": 7, "total": 10, "percentage": 70}, "kinestetik": {"score": 8, "total": 10, "percentage": 80}, "linguistik": {"score": 6, "total": 10, "percentage": 60}, "interpersonal": {"score": 8, "total": 10, "percentage": 80}, "intrapersonal": {"score": 7, "total": 10, "percentage": 70}, "visual_spasial": {"score": 7, "total": 10, "percentage": 70}, "logis_matematis": {"score": 6, "total": 10, "percentage": 60}}, "dominantIntelligences": [{"name": "Kinestetik", "score": 8, "total": 10, "category": "kinestetik", "percentage": 80}, {"name": "Interpersonal", "score": 8, "total": 10, "category": "interpersonal", "percentage": 80}, {"name": "Visual Spasial", "score": 7, "total": 10, "category": "visual_spasial", "percentage": 70}], "profilKecerdasanLengkap": [{"skor": 8, "total": 10, "dimensi": "Kinestetik", "ranking": 1, "kategori": "Tinggi", "persentase": 80, "rekomendasi": ["Integrasikan gerakan dalam proses belajar", "Ikuti aktivitas olahraga dan tari", "Praktikkan pembelajaran hands-on", "Gunakan role-play dan simulasi"]}, {"skor": 8, "total": 10, "dimensi": "Interpersonal", "ranking": 2, "kategori": "Tinggi", "persentase": 80, "rekomendasi": ["Ikuti kegiatan kelompok dan teamwork", "Praktikkan empati dan komunikasi", "Latih kemampuan leadership", "Terlibat dalam aktivitas sosial dan volunteer"]}, {"skor": 7, "total": 10, "dimensi": "Visual Spasial", "ranking": 3, "kategori": "Tinggi", "persentase": 70, "rekomendasi": ["Gunakan mind map dan diagram saat belajar", "Manfaatkan media visual seperti gambar dan video", "Praktikkan aktivitas seni dan design", "Latih kemampuan navigasi dan orientasi ruang"]}, {"skor": 7, "total": 10, "dimensi": "Musik", "ranking": 4, "kategori": "Tinggi", "persentase": 70, "rekomendasi": ["Gunakan lagu untuk mengingat informasi", "Pelajari alat musik", "Ikuti aktivitas bernyanyi atau paduan suara", "Manfaatkan ritme dalam pembelajaran"]}, {"skor": 7, "total": 10, "dimensi": "Intrapersonal", "ranking": 5, "kategori": "Tinggi", "persentase": 70, "rekomendasi": ["Luangkan waktu untuk refleksi diri", "Latih journaling dan self-assessment", "Praktikkan mindfulness dan meditasi", "Tentukan tujuan personal yang jelas"]}, {"skor": 6, "total": 10, "dimensi": "Linguistik", "ranking": 6, "kategori": "Sedang", "persentase": 60, "rekomendasi": ["Perbanyak membaca dan menulis", "Latih public speaking dan storytelling", "Pelajari bahasa asing", "Ikuti aktivitas debat dan diskusi"]}, {"skor": 6, "total": 10, "dimensi": "Logis Matematis", "ranking": 7, "kategori": "Sedang", "persentase": 60, "rekomendasi": ["Latih kemampuan problem solving", "Pelajari programming dan logika", "Mainkan game strategi dan puzzle", "Praktikkan metode ilmiah dalam berpikir"]}]}	2025-10-06 09:00:43.703	2025-10-06 08:20:36.277278
130	Zqr6APIHPrjp	8	295	completed	{"responses": {"1": "visual", "2": "visual", "3": "auditori", "4": "auditori", "5": "visual", "6": "auditori", "7": "visual", "8": "auditori", "9": "visual", "10": "auditori", "11": "visual", "12": "auditori", "13": "visual", "14": "auditori"}, "completedAt": "2025-10-06T08:57:36.666Z", "percentages": {"visual": "50.0", "auditori": "50.0", "kinestetik": "0.0"}, "styleScores": {"visual": 7, "auditori": 7, "kinestetik": 0}, "primaryStyle": "auditori", "totalResponses": 14, "participantInfo": {}}	2025-10-06 08:57:36.666	2025-10-06 08:23:13.501104
145	P0ZIeq09aNG-	7	311	completed	{"patterns": {"A": "hyposensitive", "B": "hyposensitive", "C": "hyposensitive", "D": "hyposensitive", "E": "hyposensitive", "F": "hyposensitive", "G": "hyposensitive", "H": "hyposensitive", "I": "typical", "J": "hyposensitive", "K": "hyposensitive", "L": "hyposensitive"}, "responses": {"1": "1", "2": "1", "3": "1", "4": "1", "5": "1", "6": "1", "7": "2", "8": "1", "9": "1", "10": "1", "11": "1", "12": "1", "13": "1", "14": "1", "15": "1", "16": "1", "17": "2", "18": "1", "19": "1", "20": "1", "21": "1", "22": "1", "23": "1", "24": "4", "25": "3", "26": "1", "27": "2", "28": "2", "29": "1", "30": "1", "31": "1", "32": "1", "33": "1", "34": "1", "35": "3", "36": "1", "37": "1", "38": "4", "39": "1", "40": "1", "41": "1", "42": "1", "43": "1", "44": "1", "45": "1", "46": "3", "47": "1", "48": "1", "49": "3", "50": "1", "51": "1", "52": "1", "53": "1", "54": "1", "55": "3", "56": "3", "57": "1", "58": "1", "59": "1", "60": "1", "61": "4", "62": "3", "63": "1", "64": "1", "65": "1", "66": "1", "67": "1", "68": "1", "69": "1", "70": "1", "71": "1", "72": "1", "73": "1", "74": "1", "75": "1", "76": "1", "77": "1", "78": "3", "79": "1", "80": "1", "81": "1", "82": "1", "83": "1", "84": "1", "85": "2", "86": "1", "87": "1", "88": "1", "89": "4", "90": "4", "91": "2", "92": "1", "93": "1", "94": "1", "95": "1", "96": "2", "97": "1", "98": "1", "99": "2", "100": "1", "101": "1", "102": "1", "103": "1", "104": "1", "105": "2", "106": "1", "107": "3", "108": "2", "109": "2", "110": "1", "111": "1", "112": "5", "113": "1", "114": "1", "115": "1", "116": "1", "117": "2", "118": "5", "119": "1", "120": "2", "121": "1", "122": "2", "123": "3", "124": "1"}, "totalScore": 181, "completedAt": "2026-01-29T06:11:09.561Z", "averageScore": "1.46", "sectionScores": {"A": {"count": 8, "total": 9, "average": "1.13"}, "B": {"count": 9, "total": 10, "average": "1.11"}, "C": {"count": 11, "total": 18, "average": "1.64"}, "D": {"count": 18, "total": 25, "average": "1.39"}, "E": {"count": 7, "total": 9, "average": "1.29"}, "F": {"count": 12, "total": 21, "average": "1.75"}, "G": {"count": 9, "total": 9, "average": "1.00"}, "H": {"count": 10, "total": 12, "average": "1.20"}, "I": {"count": 7, "total": 15, "average": "2.14"}, "J": {"count": 4, "total": 4, "average": "1.00"}, "K": {"count": 4, "total": 6, "average": "1.50"}, "L": {"count": 25, "total": 43, "average": "1.72"}}, "totalResponses": 124, "participantInfo": {"testDate": "2026-01-29", "childName": "Lionel mudamakin ", "parentName": "Hartiningsih", "relationship": "Ibu", "childBirthDate": "2018-12-10"}}	2026-01-29 06:11:09.561	2026-01-29 05:16:27.250699
116	LVoRx5kxy1hx	7	274	completed	{"patterns": {"A": "typical", "B": "typical", "C": "typical", "D": "typical", "E": "typical", "F": "typical", "G": "hypersensitive", "H": "typical", "I": "hypersensitive", "J": "typical", "K": "typical", "L": "typical"}, "responses": {"1": "4", "2": "3", "3": "4", "4": "3", "5": "5", "6": "3", "7": "3", "8": "4", "9": "2", "10": "2", "11": "2", "12": "3", "13": "3", "14": "2", "15": "2", "16": "1", "18": "3", "19": "4", "20": "4", "22": "2", "23": "2", "24": "4", "25": "4", "26": "4", "27": "4", "28": "4", "29": "4", "30": "4", "31": "5", "32": "4", "33": "3", "34": "4", "35": "4", "36": "3", "37": "3", "38": "4", "39": "4", "40": "4", "41": "4", "42": "4", "43": "4", "44": "4", "45": "3", "46": "3", "47": "4", "48": "4", "49": "3", "50": "4", "51": "4", "52": "4", "53": "3", "54": "4", "55": "4", "56": "4", "57": "4", "58": "4", "59": "4", "60": "3", "61": "4", "62": "4", "63": "4", "64": "3", "65": "3", "66": "4", "67": "4", "68": "4", "69": "4", "70": "4", "71": "4", "72": "4", "73": "4", "74": "4", "75": "4", "76": "4", "77": "3", "78": "3", "79": "3", "80": "3", "81": "3", "82": "3", "83": "2", "84": "3", "85": "4", "86": "3", "87": "5", "88": "5", "89": "4", "90": "4", "91": "4", "92": "4", "93": "4", "94": "3", "95": "3", "96": "3", "97": "4", "98": "4", "99": "4", "100": "4", "101": "4", "102": "4", "103": "4", "104": "4", "105": "5", "106": "2", "107": "3", "108": "3", "109": "3", "110": "3", "111": "3", "112": "3", "113": "4", "114": "4", "115": "4", "116": "4", "117": "4", "118": "4", "119": "5", "120": "5", "121": "4", "122": "5", "123": "5", "124": "3"}, "totalScore": 441, "completedAt": "2025-08-23T02:43:40.029Z", "averageScore": "3.61", "sectionScores": {"A": {"count": 8, "total": 29, "average": "3.63"}, "B": {"count": 8, "total": 17, "average": "2.13"}, "C": {"count": 10, "total": 35, "average": "3.50"}, "D": {"count": 18, "total": 68, "average": "3.78"}, "E": {"count": 7, "total": 26, "average": "3.71"}, "F": {"count": 12, "total": 45, "average": "3.75"}, "G": {"count": 9, "total": 36, "average": "4.00"}, "H": {"count": 10, "total": 31, "average": "3.10"}, "I": {"count": 7, "total": 29, "average": "4.14"}, "J": {"count": 4, "total": 14, "average": "3.50"}, "K": {"count": 4, "total": 15, "average": "3.75"}, "L": {"count": 25, "total": 96, "average": "3.84"}}, "totalResponses": 122, "participantInfo": {"testDate": "2025-08-23", "childName": "Sari", "parentName": "Yeni", "relationship": "Wali", "childBirthDate": "2022-08-25"}}	2025-08-23 02:43:40.029	2025-08-23 02:29:03.749375
109	qmTM5EUv-VeC	7	206	available	\N	\N	2025-07-24 11:26:14.287805
127	jKRKMaDheZIH	9	291	in_progress	{"ranking": [{"name": "Visual Spasial", "score": 3, "total": 10, "category": "visual_spasial", "percentage": 30}, {"name": "Intrapersonal", "score": 1, "total": 10, "category": "intrapersonal", "percentage": 10}, {"name": "Linguistik", "score": 0, "total": 10, "category": "linguistik", "percentage": 0}, {"name": "Logis Matematis", "score": 0, "total": 10, "category": "logis_matematis", "percentage": 0}, {"name": "Kinestetik", "score": 0, "total": 10, "category": "kinestetik", "percentage": 0}, {"name": "Musik", "score": 0, "total": 10, "category": "musik", "percentage": 0}, {"name": "Interpersonal", "score": 0, "total": 10, "category": "interpersonal", "percentage": 0}], "comments": {}, "lastSaved": "2025-09-24T11:43:55.337Z", "responses": {"1": true, "2": true}, "completedAt": "2025-09-24T11:43:21.846Z", "currentPage": 2, "percentages": {"musik": 0, "kinestetik": 0, "linguistik": 0, "interpersonal": 0, "intrapersonal": 10, "visual_spasial": 30, "logis_matematis": 0}, "notApplicable": {}, "categoryScores": [{"name": "Visual Spasial", "score": 3, "total": 10, "category": "visual_spasial", "percentage": 30}, {"name": "Intrapersonal", "score": 1, "total": 10, "category": "intrapersonal", "percentage": 10}, {"name": "Linguistik", "score": 0, "total": 10, "category": "linguistik", "percentage": 0}, {"name": "Logis Matematis", "score": 0, "total": 10, "category": "logis_matematis", "percentage": 0}, {"name": "Kinestetik", "score": 0, "total": 10, "category": "kinestetik", "percentage": 0}, {"name": "Musik", "score": 0, "total": 10, "category": "musik", "percentage": 0}, {"name": "Interpersonal", "score": 0, "total": 10, "category": "interpersonal", "percentage": 0}], "participantInfo": {}, "scoresByCategory": {"musik": {"score": 0, "total": 10, "percentage": 0}, "kinestetik": {"score": 0, "total": 10, "percentage": 0}, "linguistik": {"score": 0, "total": 10, "percentage": 0}, "interpersonal": {"score": 0, "total": 10, "percentage": 0}, "intrapersonal": {"score": 1, "total": 10, "percentage": 10}, "visual_spasial": {"score": 3, "total": 10, "percentage": 30}, "logis_matematis": {"score": 0, "total": 10, "percentage": 0}}, "dominantIntelligences": [{"name": "Visual Spasial", "score": 3, "total": 10, "category": "visual_spasial", "percentage": 30}, {"name": "Intrapersonal", "score": 1, "total": 10, "category": "intrapersonal", "percentage": 10}, {"name": "Linguistik", "score": 0, "total": 10, "category": "linguistik", "percentage": 0}], "profilKecerdasanLengkap": [{"skor": 3, "total": 10, "dimensi": "Visual Spasial", "ranking": 1, "kategori": "Rendah", "persentase": 30, "rekomendasi": ["Gunakan mind map dan diagram saat belajar", "Manfaatkan media visual seperti gambar dan video", "Praktikkan aktivitas seni dan design", "Latih kemampuan navigasi dan orientasi ruang"]}, {"skor": 1, "total": 10, "dimensi": "Intrapersonal", "ranking": 2, "kategori": "Rendah", "persentase": 10, "rekomendasi": ["Luangkan waktu untuk refleksi diri", "Latih journaling dan self-assessment", "Praktikkan mindfulness dan meditasi", "Tentukan tujuan personal yang jelas"]}, {"skor": 0, "total": 10, "dimensi": "Linguistik", "ranking": 3, "kategori": "Rendah", "persentase": 0, "rekomendasi": ["Perbanyak membaca dan menulis", "Latih public speaking dan storytelling", "Pelajari bahasa asing", "Ikuti aktivitas debat dan diskusi"]}, {"skor": 0, "total": 10, "dimensi": "Logis Matematis", "ranking": 4, "kategori": "Rendah", "persentase": 0, "rekomendasi": ["Latih kemampuan problem solving", "Pelajari programming dan logika", "Mainkan game strategi dan puzzle", "Praktikkan metode ilmiah dalam berpikir"]}, {"skor": 0, "total": 10, "dimensi": "Kinestetik", "ranking": 5, "kategori": "Rendah", "persentase": 0, "rekomendasi": ["Integrasikan gerakan dalam proses belajar", "Ikuti aktivitas olahraga dan tari", "Praktikkan pembelajaran hands-on", "Gunakan role-play dan simulasi"]}, {"skor": 0, "total": 10, "dimensi": "Musik", "ranking": 6, "kategori": "Rendah", "persentase": 0, "rekomendasi": ["Gunakan lagu untuk mengingat informasi", "Pelajari alat musik", "Ikuti aktivitas bernyanyi atau paduan suara", "Manfaatkan ritme dalam pembelajaran"]}, {"skor": 0, "total": 10, "dimensi": "Interpersonal", "ranking": 7, "kategori": "Rendah", "persentase": 0, "rekomendasi": ["Ikuti kegiatan kelompok dan teamwork", "Praktikkan empati dan komunikasi", "Latih kemampuan leadership", "Terlibat dalam aktivitas sosial dan volunteer"]}]}	2025-09-24 11:43:21.846	2025-09-24 11:40:49.799119
131	admin	7	297	in_progress	{"comments": {}, "lastSaved": "2025-10-06T23:14:16.385Z", "responses": {"1": "5", "2": "4", "3": "3", "4": "4", "5": "5", "6": "2", "7": "1", "8": "2", "9": "4", "10": "3"}, "currentPage": 0, "notApplicable": {}, "participantInfo": {"testDate": "2025-10-06", "childName": "Anastasia", "parentName": "Joss", "relationship": "Ayah", "childBirthDate": "2018-01-10"}}	\N	2025-10-06 09:13:01.004296
137	9wZHAapaLS1o	7	303	purchased	\N	\N	2025-10-08 04:08:12.718375
104	qmTM5EUv-VeC	8	198	available	\N	\N	2025-07-24 10:06:09.045907
103	IqO9IlNVqHch	7	195	completed	{"patterns": {"A": "typical", "B": "typical", "C": "typical", "D": "typical", "E": "typical", "F": "typical", "G": "typical", "H": "typical", "I": "typical", "J": "typical", "K": "typical", "L": "typical"}, "responses": {"1": "4", "2": "3", "3": "4", "4": "3", "5": "4", "6": "3", "7": "4", "8": "3", "9": "4", "10": "4", "11": "3", "12": "2", "13": "1", "14": "4", "15": "3", "16": "4", "17": "3", "18": "4", "19": "3", "20": "4", "21": "3", "22": "4", "23": "3", "24": "4", "25": "3", "26": "4", "27": "3", "28": "4", "29": "3", "30": "4", "31": "3", "32": "2", "33": "4", "34": "3", "35": "4", "36": "3", "37": "4", "38": "3", "39": "4", "40": "3", "41": "3", "42": "4", "43": "3", "44": "3", "45": "2", "46": "4", "47": "3", "48": "4", "49": "3", "50": "4", "51": "3", "52": "4", "53": "3", "54": "4", "55": "3", "56": "4", "57": "3", "58": "4", "59": "3", "60": "4", "61": "4", "62": "3", "63": "4", "64": "3", "65": "4", "66": "3", "67": "3", "68": "2", "69": "4", "70": "3", "71": "4", "72": "3", "73": "4", "74": "3", "75": "4", "76": "3", "77": "4", "78": "3", "79": "4", "80": "3", "81": "4", "82": "3", "83": "4", "84": "3", "85": "4", "86": "3", "87": "4", "88": "3", "89": "4", "90": "3", "91": "3", "92": "4", "93": "3", "94": "4", "95": "3", "96": "4", "97": "3", "98": "4", "99": "3", "100": "4", "101": "3", "102": "4", "103": "3", "104": "4", "105": "3", "106": "4", "107": "3", "108": "4", "109": "4", "110": "3", "111": "4", "112": "4", "113": "5", "114": "4", "115": "4", "116": "3", "117": "4", "118": "3", "119": "4", "120": "3", "121": "3", "122": "4", "123": "3", "124": "4", "125": "4"}, "totalScore": 432, "completedAt": "2025-07-25T14:18:46.557Z", "averageScore": "3.46", "sectionScores": {"A": {"count": 8, "total": 28, "average": "3.50"}, "B": {"count": 9, "total": 28, "average": "3.11"}, "C": {"count": 11, "total": 39, "average": "3.55"}, "D": {"count": 18, "total": 59, "average": "3.28"}, "E": {"count": 7, "total": 24, "average": "3.43"}, "F": {"count": 12, "total": 43, "average": "3.58"}, "G": {"count": 9, "total": 29, "average": "3.22"}, "H": {"count": 10, "total": 35, "average": "3.50"}, "I": {"count": 7, "total": 24, "average": "3.43"}, "J": {"count": 4, "total": 14, "average": "3.50"}, "K": {"count": 4, "total": 14, "average": "3.50"}, "L": {"count": 26, "total": 95, "average": "3.65"}}, "totalResponses": 125, "participantInfo": {"testDate": "2025-07-25", "childName": "Anastasia", "parentName": "Tommy", "relationship": "Ayah", "childBirthDate": "2015-01-01"}}	2025-07-25 14:18:46.557	2025-07-24 09:48:20.385421
119	wJCU6NoZ5-PA	8	283	completed	{"responses": {"1": "visual", "2": "visual", "3": "visual", "4": "visual", "5": "auditori", "6": "auditori", "7": "visual", "8": "auditori", "9": "visual", "10": "visual", "11": "visual", "12": "visual", "13": "visual", "14": "visual"}, "completedAt": "2025-09-08T00:33:42.712Z", "percentages": {"visual": "78.6", "auditori": "21.4", "kinestetik": "0.0"}, "styleScores": {"visual": 11, "auditori": 3, "kinestetik": 0}, "primaryStyle": "visual", "totalResponses": 14, "participantInfo": {}}	2025-09-08 00:33:42.712	2025-09-08 00:27:13.164865
135	Nz0YaiuDTaoH	7	301	purchased	\N	\N	2025-10-07 02:10:55.18835
138	MNWv_X5sPskg	9	304	in_progress	{"comments": {}, "lastSaved": "2025-10-15T02:43:51.224Z", "responses": {"1": true}, "currentPage": 0, "notApplicable": {}, "participantInfo": {}}	\N	2025-10-15 02:43:34.495918
113	IqO9IlNVqHch	8	225	completed	{"responses": {"1": "auditori", "2": "visual", "3": "auditori", "4": "kinestetik", "5": "auditori", "6": "kinestetik", "7": "auditori", "8": "kinestetik", "9": "auditori", "10": "auditori", "11": "visual", "12": "auditori", "13": "auditori", "14": "visual"}, "completedAt": "2025-07-26T13:44:11.156Z", "percentages": {"visual": "21.4", "auditori": "57.1", "kinestetik": "21.4"}, "styleScores": {"visual": 3, "auditori": 8, "kinestetik": 3}, "primaryStyle": "auditori", "totalResponses": 14, "participantInfo": {}}	2025-07-26 13:44:11.156	2025-07-26 13:43:32.791486
114	qmTM5EUv-VeC	7	229	available	\N	\N	2025-08-05 14:44:03.952984
115	LVoRx5kxy1hx	8	268	completed	{"responses": {"1": "visual", "2": "visual", "3": "auditori", "4": "visual", "5": "auditori", "6": "visual", "7": "kinestetik", "8": "auditori", "9": "auditori", "10": "visual", "11": "visual", "12": "kinestetik", "13": "kinestetik", "14": "visual"}, "completedAt": "2025-09-28T11:41:25.871Z", "percentages": {"visual": "50.0", "auditori": "28.6", "kinestetik": "21.4"}, "styleScores": {"visual": 7, "auditori": 4, "kinestetik": 3}, "primaryStyle": "visual", "totalResponses": 14, "participantInfo": {}}	2025-09-28 11:41:25.871	2025-08-22 06:38:50.709356
117	90IRpTsRLVfE	8	275	completed	{"responses": {"1": "visual", "2": "visual", "3": "kinestetik", "4": "kinestetik", "5": "visual", "6": "visual", "7": "visual", "8": "visual", "9": "auditori", "10": "visual", "11": "visual", "12": "kinestetik", "13": "visual", "14": "visual"}, "completedAt": "2025-08-23T05:19:41.903Z", "percentages": {"visual": "71.4", "auditori": "7.1", "kinestetik": "21.4"}, "styleScores": {"visual": 10, "auditori": 1, "kinestetik": 3}, "primaryStyle": "visual", "totalResponses": 14, "participantInfo": {}}	2025-08-23 05:19:41.903	2025-08-23 05:15:52.766035
118	TvCd1ViqqEfE	8	282	completed	{"responses": {"1": "kinestetik", "2": "auditori", "3": "kinestetik", "4": "auditori", "5": "visual", "6": "visual", "7": "kinestetik", "8": "visual", "9": "visual", "10": "kinestetik", "11": "visual", "12": "kinestetik", "13": "visual", "14": "kinestetik"}, "completedAt": "2025-09-03T14:00:01.204Z", "percentages": {"visual": "42.9", "auditori": "14.3", "kinestetik": "42.9"}, "styleScores": {"visual": 6, "auditori": 2, "kinestetik": 6}, "primaryStyle": "kinestetik", "totalResponses": 14, "participantInfo": {}}	2025-09-03 14:00:01.204	2025-09-03 13:54:07.324861
133	90IRpTsRLVfE	7	299	purchased	\N	\N	2025-10-07 02:07:05.023952
134	9wZHAapaLS1o	8	300	completed	{"responses": {"1": "visual", "2": "visual", "3": "kinestetik", "4": "kinestetik", "5": "auditori", "6": "visual", "7": "kinestetik", "8": "auditori", "9": "visual", "10": "visual", "11": "visual", "12": "visual", "13": "visual", "14": "visual"}, "completedAt": "2025-10-07T02:14:24.756Z", "percentages": {"visual": "64.3", "auditori": "14.3", "kinestetik": "21.4"}, "styleScores": {"visual": 9, "auditori": 2, "kinestetik": 3}, "primaryStyle": "visual", "totalResponses": 14, "participantInfo": {}}	2025-10-07 02:14:24.756	2025-10-07 02:10:07.08709
139	JMGk2hu71-ZQ	8	305	completed	{"responses": {"1": "visual", "2": "visual", "3": "kinestetik", "4": "auditori", "5": "kinestetik", "6": "auditori", "7": "visual", "8": "auditori", "9": "auditori", "10": "kinestetik", "11": "kinestetik", "12": "visual", "13": "visual", "14": "visual"}, "completedAt": "2025-10-17T11:53:19.031Z", "percentages": {"visual": "42.9", "auditori": "28.6", "kinestetik": "28.6"}, "styleScores": {"visual": 6, "auditori": 4, "kinestetik": 4}, "primaryStyle": "visual", "totalResponses": 14, "participantInfo": {}}	2025-10-17 11:53:19.031	2025-10-17 11:47:12.984299
136	T1gm3pG2h_o0	7	302	purchased	\N	\N	2025-10-07 02:35:44.582601
146	nyc8-QmerUlh	7	312	completed	{"patterns": {"A": "typical", "B": "hyposensitive", "C": "hyposensitive", "D": "typical", "E": "hyposensitive", "F": "hyposensitive", "G": "hyposensitive", "H": "hyposensitive", "I": "hyposensitive", "J": "hyposensitive", "K": "hyposensitive", "L": "hyposensitive"}, "responses": {"1": "4", "2": "1", "3": "2", "4": "2", "5": "1", "6": "4", "7": "3", "8": "4", "9": "1", "10": "1", "11": "1", "13": "1", "14": "1", "15": "1", "16": "3", "18": "1", "19": "1", "20": "1", "21": "1", "22": "1", "23": "1", "24": "3", "25": "4", "26": "2", "27": "4", "28": "2", "29": "3", "30": "3", "31": "1", "32": "2", "33": "2", "34": "1", "35": "1", "36": "1", "37": "1", "38": "4", "39": "1", "40": "4", "41": "4", "42": "1", "43": "1", "44": "1", "45": "4", "46": "2", "47": "1", "48": "4", "50": "1", "51": "4", "52": "1", "53": "1", "54": "1", "55": "1", "56": "1", "57": "1", "58": "1", "59": "1", "60": "1", "61": "4", "63": "1", "64": "1", "65": "4", "66": "1", "67": "1", "68": "1", "69": "1", "70": "1", "71": "1", "72": "1", "73": "1", "74": "1", "75": "2", "76": "1", "77": "1", "78": "1", "79": "2", "80": "1", "81": "1", "82": "1", "83": "1", "84": "1", "85": "1", "86": "2", "87": "1", "88": "1", "89": "3", "90": "4", "91": "2", "92": "3", "93": "1", "94": "1", "95": "2", "96": "3", "97": "2", "98": "1", "99": "2", "100": "1", "102": "1", "103": "3", "104": "1", "105": "1", "107": "1", "108": "3", "109": "1", "110": "2", "111": "1", "112": "4", "113": "1", "114": "1", "115": "1", "116": "1", "117": "4", "118": "2", "119": "2", "120": "1", "121": "1", "122": "4", "123": "3", "124": "2"}, "totalScore": 209, "completedAt": "2026-02-01T01:22:22.935Z", "averageScore": "1.77", "sectionScores": {"A": {"count": 8, "total": 21, "average": "2.63"}, "B": {"count": 7, "total": 9, "average": "1.29"}, "C": {"count": 11, "total": 21, "average": "1.91"}, "D": {"count": 18, "total": 37, "average": "2.06"}, "E": {"count": 6, "total": 12, "average": "2.00"}, "F": {"count": 11, "total": 17, "average": "1.55"}, "G": {"count": 9, "total": 9, "average": "1.00"}, "H": {"count": 10, "total": 12, "average": "1.20"}, "I": {"count": 7, "total": 14, "average": "2.00"}, "J": {"count": 4, "total": 7, "average": "1.75"}, "K": {"count": 4, "total": 8, "average": "2.00"}, "L": {"count": 23, "total": 42, "average": "1.83"}}, "totalResponses": 118, "participantInfo": {"testDate": "2026-02-01", "childName": "Sijiandru Maula Satria", "parentName": "Wahyunita Setyaningrum", "relationship": "Ibu", "childBirthDate": "2020-04-25"}}	2026-02-01 01:22:22.935	2026-01-30 10:47:31.209359
140	JMGk2hu71-ZQ	9	306	in_progress	{"comments": {}, "lastSaved": "2025-10-17T12:05:24.929Z", "responses": {"1": false, "2": true, "3": false, "4": false, "5": true, "6": true, "7": false, "8": true, "9": true, "10": true, "11": true, "12": true, "13": false, "14": true, "15": false, "16": false, "17": true, "18": false, "19": false, "20": true, "21": true, "22": false}, "currentPage": 22, "notApplicable": {}, "participantInfo": {}}	\N	2025-10-17 12:01:40.256962
152	ILNui9BbubDL	7	318	purchased	\N	\N	2026-03-26 05:41:01.648847
148	aCBnJE-nuzqq	8	314	completed	{"responses": {"1": "visual", "2": "kinestetik", "3": "kinestetik", "4": "auditori", "5": "kinestetik", "6": "auditori", "7": "visual", "8": "auditori", "9": "kinestetik", "10": "kinestetik", "11": "kinestetik", "12": "kinestetik", "13": "kinestetik", "14": "visual"}, "completedAt": "2026-02-19T09:02:56.251Z", "percentages": {"visual": "21.4", "auditori": "21.4", "kinestetik": "57.1"}, "styleScores": {"visual": 3, "auditori": 3, "kinestetik": 8}, "primaryStyle": "kinestetik", "totalResponses": 14, "participantInfo": {}}	2026-02-19 09:02:56.251	2026-02-19 08:59:53.956813
147	kZzxpJ0CVEgI	7	313	completed	{"patterns": {"A": "typical", "B": "hyposensitive", "C": "hyposensitive", "D": "hyposensitive", "E": "typical", "F": "typical", "G": "hyposensitive", "H": "hyposensitive", "I": "typical", "J": "typical", "K": "typical", "L": "typical"}, "responses": {"1": "5", "2": "5", "5": "1", "6": "1", "7": "1", "8": "5", "9": "1", "10": "1", "11": "1", "12": "1", "14": "1", "15": "1", "16": "1", "17": "3", "18": "1", "19": "1", "20": "1", "21": "1", "22": "1", "23": "1", "24": "4", "25": "4", "26": "3", "27": "1", "28": "2", "29": "2", "30": "1", "31": "1", "32": "1", "33": "1", "34": "1", "35": "3", "36": "1", "37": "1", "38": "1", "39": "1", "40": "1", "42": "1", "43": "4", "44": "1", "45": "4", "46": "4", "47": "2", "48": "4", "49": "4", "50": "5", "51": "1", "52": "1", "53": "1", "54": "1", "55": "3", "56": "4", "57": "4", "58": "4", "59": "1", "60": "1", "61": "5", "62": "5", "63": "1", "64": "1", "65": "1", "66": "1", "67": "1", "68": "1", "69": "3", "70": "3", "71": "3", "72": "1", "73": "1", "74": "1", "75": "4", "76": "3", "77": "1", "78": "1", "80": "1", "81": "1", "82": "1", "83": "1", "84": "1", "85": "1", "86": "4", "87": "4", "88": "3", "89": "4", "90": "4", "91": "3", "92": "3", "93": "4", "94": "4", "95": "1", "96": "2", "97": "3", "98": "2", "99": "4", "104": "1", "105": "3", "106": "4", "107": "3", "108": "4", "110": "3", "111": "2", "112": "3", "113": "2", "114": "4", "115": "1", "116": "1", "117": "2", "118": "3", "119": "2", "120": "3", "121": "2", "122": "2", "123": "3", "124": "3"}, "totalScore": 252, "completedAt": "2026-02-11T12:49:53.477Z", "averageScore": "2.21", "sectionScores": {"A": {"count": 6, "total": 18, "average": "3.00"}, "B": {"count": 8, "total": 10, "average": "1.25"}, "C": {"count": 11, "total": 20, "average": "1.82"}, "D": {"count": 17, "total": 29, "average": "1.71"}, "E": {"count": 7, "total": 18, "average": "2.57"}, "F": {"count": 12, "total": 31, "average": "2.58"}, "G": {"count": 9, "total": 15, "average": "1.67"}, "H": {"count": 9, "total": 14, "average": "1.56"}, "I": {"count": 7, "total": 23, "average": "3.29"}, "J": {"count": 4, "total": 12, "average": "3.00"}, "K": {"count": 4, "total": 11, "average": "2.75"}, "L": {"count": 20, "total": 51, "average": "2.55"}}, "totalResponses": 114, "participantInfo": {"testDate": "2026-02-11", "childName": "Arkana Ramdhan Narendra", "parentName": "Utami Fachrah Diba", "relationship": "Ibu", "childBirthDate": "2020-05-20"}}	2026-02-11 12:49:53.478	2026-02-11 09:35:20.8966
150	aCBnJE-nuzqq	9	316	completed	{"ranking": [{"name": "Kinestetik", "score": 9, "total": 10, "category": "kinestetik", "percentage": 90}, {"name": "Logis Matematis", "score": 8, "total": 10, "category": "logis_matematis", "percentage": 80}, {"name": "Visual Spasial", "score": 7, "total": 10, "category": "visual_spasial", "percentage": 70}, {"name": "Intrapersonal", "score": 7, "total": 10, "category": "intrapersonal", "percentage": 70}, {"name": "Linguistik", "score": 4, "total": 10, "category": "linguistik", "percentage": 40}, {"name": "Musik", "score": 4, "total": 10, "category": "musik", "percentage": 40}, {"name": "Interpersonal", "score": 3, "total": 10, "category": "interpersonal", "percentage": 30}], "responses": {"1": false, "2": true, "3": true, "4": false, "5": true, "6": false, "7": true, "8": true, "9": true, "10": true, "11": false, "12": false, "13": true, "14": false, "15": false, "16": false, "17": true, "18": false, "19": true, "20": true, "21": true, "22": true, "23": false, "24": false, "25": true, "26": true, "27": true, "28": true, "29": true, "30": true, "31": true, "32": true, "33": true, "34": true, "35": true, "36": true, "37": true, "38": true, "39": true, "40": false, "41": false, "42": false, "43": true, "44": false, "45": false, "46": true, "47": false, "48": true, "49": false, "50": true, "51": false, "52": false, "53": true, "54": false, "55": false, "56": true, "57": false, "58": false, "59": false, "60": true, "61": false, "62": true, "63": true, "64": false, "65": true, "66": true, "67": true, "68": true, "69": false, "70": true}, "completedAt": "2026-02-20T08:32:02.990Z", "percentages": {"musik": 40, "kinestetik": 90, "linguistik": 40, "interpersonal": 30, "intrapersonal": 70, "visual_spasial": 70, "logis_matematis": 80}, "categoryScores": [{"name": "Kinestetik", "score": 9, "total": 10, "category": "kinestetik", "percentage": 90}, {"name": "Logis Matematis", "score": 8, "total": 10, "category": "logis_matematis", "percentage": 80}, {"name": "Visual Spasial", "score": 7, "total": 10, "category": "visual_spasial", "percentage": 70}, {"name": "Intrapersonal", "score": 7, "total": 10, "category": "intrapersonal", "percentage": 70}, {"name": "Linguistik", "score": 4, "total": 10, "category": "linguistik", "percentage": 40}, {"name": "Musik", "score": 4, "total": 10, "category": "musik", "percentage": 40}, {"name": "Interpersonal", "score": 3, "total": 10, "category": "interpersonal", "percentage": 30}], "participantInfo": {}, "scoresByCategory": {"musik": {"score": 4, "total": 10, "percentage": 40}, "kinestetik": {"score": 9, "total": 10, "percentage": 90}, "linguistik": {"score": 4, "total": 10, "percentage": 40}, "interpersonal": {"score": 3, "total": 10, "percentage": 30}, "intrapersonal": {"score": 7, "total": 10, "percentage": 70}, "visual_spasial": {"score": 7, "total": 10, "percentage": 70}, "logis_matematis": {"score": 8, "total": 10, "percentage": 80}}, "dominantIntelligences": [{"name": "Kinestetik", "score": 9, "total": 10, "category": "kinestetik", "percentage": 90}, {"name": "Logis Matematis", "score": 8, "total": 10, "category": "logis_matematis", "percentage": 80}, {"name": "Visual Spasial", "score": 7, "total": 10, "category": "visual_spasial", "percentage": 70}], "profilKecerdasanLengkap": [{"skor": 9, "total": 10, "dimensi": "Kinestetik", "ranking": 1, "kategori": "Tinggi", "persentase": 90, "rekomendasi": ["Integrasikan gerakan dalam proses belajar", "Ikuti aktivitas olahraga dan tari", "Praktikkan pembelajaran hands-on", "Gunakan role-play dan simulasi"]}, {"skor": 8, "total": 10, "dimensi": "Logis Matematis", "ranking": 2, "kategori": "Tinggi", "persentase": 80, "rekomendasi": ["Latih kemampuan problem solving", "Pelajari programming dan logika", "Mainkan game strategi dan puzzle", "Praktikkan metode ilmiah dalam berpikir"]}, {"skor": 7, "total": 10, "dimensi": "Visual Spasial", "ranking": 3, "kategori": "Tinggi", "persentase": 70, "rekomendasi": ["Gunakan mind map dan diagram saat belajar", "Manfaatkan media visual seperti gambar dan video", "Praktikkan aktivitas seni dan design", "Latih kemampuan navigasi dan orientasi ruang"]}, {"skor": 7, "total": 10, "dimensi": "Intrapersonal", "ranking": 4, "kategori": "Tinggi", "persentase": 70, "rekomendasi": ["Luangkan waktu untuk refleksi diri", "Latih journaling dan self-assessment", "Praktikkan mindfulness dan meditasi", "Tentukan tujuan personal yang jelas"]}, {"skor": 4, "total": 10, "dimensi": "Linguistik", "ranking": 5, "kategori": "Sedang", "persentase": 40, "rekomendasi": ["Perbanyak membaca dan menulis", "Latih public speaking dan storytelling", "Pelajari bahasa asing", "Ikuti aktivitas debat dan diskusi"]}, {"skor": 4, "total": 10, "dimensi": "Musik", "ranking": 6, "kategori": "Sedang", "persentase": 40, "rekomendasi": ["Gunakan lagu untuk mengingat informasi", "Pelajari alat musik", "Ikuti aktivitas bernyanyi atau paduan suara", "Manfaatkan ritme dalam pembelajaran"]}, {"skor": 3, "total": 10, "dimensi": "Interpersonal", "ranking": 7, "kategori": "Rendah", "persentase": 30, "rekomendasi": ["Ikuti kegiatan kelompok dan teamwork", "Praktikkan empati dan komunikasi", "Latih kemampuan leadership", "Terlibat dalam aktivitas sosial dan volunteer"]}]}	2026-02-20 08:32:02.99	2026-02-19 14:08:36.998491
153	yBqNeMDOpVxn	7	321	in_progress	{"comments": {}, "lastSaved": "2026-03-28T01:03:01.975Z", "responses": {"1": "2", "2": "1", "3": "5", "4": "5", "5": "5", "6": "5", "7": "5", "8": "5", "9": "4", "10": "5", "11": "5", "12": "4", "13": "5", "14": "4", "15": "4", "16": "4", "17": "4", "18": "4", "19": "4", "20": "4", "21": "4", "22": "4", "23": "4", "24": "4", "25": "3", "26": "4", "27": "4", "28": "5", "29": "4", "30": "4"}, "currentPage": 1, "notApplicable": {}, "participantInfo": {"testDate": "2026-03-27", "childName": "Anggita", "parentName": "Ajeng", "relationship": "Wali", "childBirthDate": "2020-03-31"}}	\N	2026-03-27 09:37:58.978204
155	38uyQgQLGMt3	7	324	completed	{"patterns": {"A": "typical", "B": "hyposensitive", "C": "hyposensitive", "D": "typical", "E": "typical", "F": "typical", "G": "hyposensitive", "H": "hyposensitive", "I": "typical", "J": "typical", "K": "typical", "L": "typical"}, "responses": {"1": "2", "2": "3", "3": "3", "4": "3", "5": "3", "6": "3", "7": "2", "8": "3", "9": "1", "10": "1", "11": "1", "12": "3", "13": "4", "14": "1", "15": "1", "16": "3", "17": "3", "18": "1", "19": "3", "20": "1", "21": "1", "22": "1", "23": "1", "24": "2", "25": "3", "26": "1", "27": "3", "28": "1", "29": "3", "30": "3", "31": "1", "32": "3", "33": "3", "34": "1", "35": "1", "36": "2", "37": "2", "38": "3", "39": "2", "40": "2", "41": "3", "42": "1", "43": "1", "44": "2", "45": "2", "46": "3", "47": "3", "48": "3", "49": "3", "50": "3", "51": "1", "52": "3", "53": "2", "54": "1", "55": "3", "56": "4", "57": "2", "58": "4", "59": "3", "60": "3", "61": "5", "62": "4", "63": "3", "64": "2", "65": "2", "66": "1", "67": "2", "68": "2", "69": "1", "70": "3", "71": "1", "72": "1", "73": "1", "74": "1", "75": "3", "76": "2", "77": "1", "78": "2", "79": "3", "80": "1", "81": "3", "82": "2", "83": "1", "84": "1", "85": "3", "86": "4", "87": "3", "88": "3", "89": "2", "90": "3", "91": "2", "92": "2", "93": "2", "94": "3", "95": "3", "96": "3", "97": "3", "98": "3", "99": "3", "100": "2", "101": "4", "102": "2", "103": "3", "104": "3", "105": "4", "106": "4", "107": "4", "108": "4", "109": "4", "110": "3", "111": "3", "112": "4", "113": "1", "114": "1", "115": "3", "116": "1", "117": "4", "118": "4", "119": "3", "120": "3", "121": "3", "122": "3", "123": "3", "124": "4", "125": "4"}, "totalScore": 305, "completedAt": "2026-03-30T03:15:20.294Z", "averageScore": "2.44", "sectionScores": {"A": {"count": 8, "total": 22, "average": "2.75"}, "B": {"count": 9, "total": 18, "average": "2.00"}, "C": {"count": 11, "total": 18, "average": "1.64"}, "D": {"count": 18, "total": 38, "average": "2.11"}, "E": {"count": 7, "total": 18, "average": "2.57"}, "F": {"count": 12, "total": 36, "average": "3.00"}, "G": {"count": 9, "total": 13, "average": "1.44"}, "H": {"count": 10, "total": 19, "average": "1.90"}, "I": {"count": 7, "total": 20, "average": "2.86"}, "J": {"count": 4, "total": 10, "average": "2.50"}, "K": {"count": 4, "total": 12, "average": "3.00"}, "L": {"count": 26, "total": 81, "average": "3.12"}}, "totalResponses": 125, "participantInfo": {"testDate": "2026-03-30", "childName": "Nathisa Marinka Hutomo", "parentName": "Fita Meriana", "relationship": "Ayah", "childBirthDate": "2018-08-25"}}	2026-03-30 03:15:20.294	2026-03-30 02:45:58.325821
121	IqO9IlNVqHch	9	285	in_progress	{"ranking": [{"name": "Linguistik", "score": 8, "total": 10, "category": "linguistik", "percentage": 80}, {"name": "Logis Matematis", "score": 8, "total": 10, "category": "logis_matematis", "percentage": 80}, {"name": "Musik", "score": 8, "total": 10, "category": "musik", "percentage": 80}, {"name": "Kinestetik", "score": 7, "total": 10, "category": "kinestetik", "percentage": 70}, {"name": "Interpersonal", "score": 7, "total": 10, "category": "interpersonal", "percentage": 70}, {"name": "Visual Spasial", "score": 6, "total": 10, "category": "visual_spasial", "percentage": 60}, {"name": "Intrapersonal", "score": 5, "total": 10, "category": "intrapersonal", "percentage": 50}], "comments": {}, "lastSaved": "2025-09-22T05:53:53.918Z", "responses": {"1": false, "2": true, "3": true}, "completedAt": "2025-09-22T05:50:40.104Z", "currentPage": 3, "percentages": {"musik": 80, "kinestetik": 70, "linguistik": 80, "interpersonal": 70, "intrapersonal": 50, "visual_spasial": 60, "logis_matematis": 80}, "notApplicable": {}, "categoryScores": [{"name": "Linguistik", "score": 8, "total": 10, "category": "linguistik", "percentage": 80}, {"name": "Logis Matematis", "score": 8, "total": 10, "category": "logis_matematis", "percentage": 80}, {"name": "Musik", "score": 8, "total": 10, "category": "musik", "percentage": 80}, {"name": "Kinestetik", "score": 7, "total": 10, "category": "kinestetik", "percentage": 70}, {"name": "Interpersonal", "score": 7, "total": 10, "category": "interpersonal", "percentage": 70}, {"name": "Visual Spasial", "score": 6, "total": 10, "category": "visual_spasial", "percentage": 60}, {"name": "Intrapersonal", "score": 5, "total": 10, "category": "intrapersonal", "percentage": 50}], "participantInfo": {}, "scoresByCategory": {"musik": {"score": 8, "total": 10, "percentage": 80}, "kinestetik": {"score": 7, "total": 10, "percentage": 70}, "linguistik": {"score": 8, "total": 10, "percentage": 80}, "interpersonal": {"score": 7, "total": 10, "percentage": 70}, "intrapersonal": {"score": 5, "total": 10, "percentage": 50}, "visual_spasial": {"score": 6, "total": 10, "percentage": 60}, "logis_matematis": {"score": 8, "total": 10, "percentage": 80}}, "dominantIntelligences": [{"name": "Linguistik", "score": 8, "total": 10, "category": "linguistik", "percentage": 80}, {"name": "Logis Matematis", "score": 8, "total": 10, "category": "logis_matematis", "percentage": 80}, {"name": "Musik", "score": 8, "total": 10, "category": "musik", "percentage": 80}], "profilKecerdasanLengkap": [{"skor": 8, "total": 10, "dimensi": "Linguistik", "ranking": 1, "kategori": "Tinggi", "persentase": 80, "rekomendasi": ["Perbanyak membaca dan menulis", "Latih public speaking dan storytelling", "Pelajari bahasa asing", "Ikuti aktivitas debat dan diskusi"]}, {"skor": 8, "total": 10, "dimensi": "Logis Matematis", "ranking": 2, "kategori": "Tinggi", "persentase": 80, "rekomendasi": ["Latih kemampuan problem solving", "Pelajari programming dan logika", "Mainkan game strategi dan puzzle", "Praktikkan metode ilmiah dalam berpikir"]}, {"skor": 8, "total": 10, "dimensi": "Musik", "ranking": 3, "kategori": "Tinggi", "persentase": 80, "rekomendasi": ["Gunakan lagu untuk mengingat informasi", "Pelajari alat musik", "Ikuti aktivitas bernyanyi atau paduan suara", "Manfaatkan ritme dalam pembelajaran"]}, {"skor": 7, "total": 10, "dimensi": "Kinestetik", "ranking": 4, "kategori": "Tinggi", "persentase": 70, "rekomendasi": ["Integrasikan gerakan dalam proses belajar", "Ikuti aktivitas olahraga dan tari", "Praktikkan pembelajaran hands-on", "Gunakan role-play dan simulasi"]}, {"skor": 7, "total": 10, "dimensi": "Interpersonal", "ranking": 5, "kategori": "Tinggi", "persentase": 70, "rekomendasi": ["Ikuti kegiatan kelompok dan teamwork", "Praktikkan empati dan komunikasi", "Latih kemampuan leadership", "Terlibat dalam aktivitas sosial dan volunteer"]}, {"skor": 6, "total": 10, "dimensi": "Visual Spasial", "ranking": 6, "kategori": "Sedang", "persentase": 60, "rekomendasi": ["Gunakan mind map dan diagram saat belajar", "Manfaatkan media visual seperti gambar dan video", "Praktikkan aktivitas seni dan design", "Latih kemampuan navigasi dan orientasi ruang"]}, {"skor": 5, "total": 10, "dimensi": "Intrapersonal", "ranking": 7, "kategori": "Sedang", "persentase": 50, "rekomendasi": ["Luangkan waktu untuk refleksi diri", "Latih journaling dan self-assessment", "Praktikkan mindfulness dan meditasi", "Tentukan tujuan personal yang jelas"]}]}	2025-09-22 05:50:40.104	2025-09-21 06:43:20.805928
151	s6tQ4RrnS1HM	9	317	completed	{"ranking": [{"name": "Visual Spasial", "score": 9, "total": 10, "category": "visual_spasial", "percentage": 90}, {"name": "Kinestetik", "score": 8, "total": 10, "category": "kinestetik", "percentage": 80}, {"name": "Musik", "score": 7, "total": 10, "category": "musik", "percentage": 70}, {"name": "Intrapersonal", "score": 6, "total": 10, "category": "intrapersonal", "percentage": 60}, {"name": "Linguistik", "score": 3, "total": 10, "category": "linguistik", "percentage": 30}, {"name": "Logis Matematis", "score": 3, "total": 10, "category": "logis_matematis", "percentage": 30}, {"name": "Interpersonal", "score": 2, "total": 10, "category": "interpersonal", "percentage": 20}], "responses": {"1": true, "2": true, "3": true, "4": false, "5": true, "6": true, "7": true, "8": true, "9": true, "10": true, "11": true, "12": true, "13": false, "14": true, "15": false, "16": false, "17": false, "18": false, "19": false, "20": false, "21": false, "22": true, "23": false, "24": false, "25": false, "26": false, "27": false, "28": false, "29": true, "30": true, "31": false, "32": true, "33": true, "34": false, "35": true, "36": true, "37": true, "38": true, "39": true, "40": true, "41": false, "42": false, "43": false, "44": true, "45": true, "46": true, "47": true, "48": true, "49": true, "50": true, "51": false, "52": true, "53": false, "54": false, "55": true, "56": false, "57": false, "58": false, "59": false, "60": false, "61": true, "62": false, "63": false, "64": false, "65": true, "66": true, "67": false, "68": true, "69": true, "70": true}, "completedAt": "2026-03-03T08:41:35.430Z", "percentages": {"musik": 70, "kinestetik": 80, "linguistik": 30, "interpersonal": 20, "intrapersonal": 60, "visual_spasial": 90, "logis_matematis": 30}, "categoryScores": [{"name": "Visual Spasial", "score": 9, "total": 10, "category": "visual_spasial", "percentage": 90}, {"name": "Kinestetik", "score": 8, "total": 10, "category": "kinestetik", "percentage": 80}, {"name": "Musik", "score": 7, "total": 10, "category": "musik", "percentage": 70}, {"name": "Intrapersonal", "score": 6, "total": 10, "category": "intrapersonal", "percentage": 60}, {"name": "Linguistik", "score": 3, "total": 10, "category": "linguistik", "percentage": 30}, {"name": "Logis Matematis", "score": 3, "total": 10, "category": "logis_matematis", "percentage": 30}, {"name": "Interpersonal", "score": 2, "total": 10, "category": "interpersonal", "percentage": 20}], "participantInfo": {}, "scoresByCategory": {"musik": {"score": 7, "total": 10, "percentage": 70}, "kinestetik": {"score": 8, "total": 10, "percentage": 80}, "linguistik": {"score": 3, "total": 10, "percentage": 30}, "interpersonal": {"score": 2, "total": 10, "percentage": 20}, "intrapersonal": {"score": 6, "total": 10, "percentage": 60}, "visual_spasial": {"score": 9, "total": 10, "percentage": 90}, "logis_matematis": {"score": 3, "total": 10, "percentage": 30}}, "dominantIntelligences": [{"name": "Visual Spasial", "score": 9, "total": 10, "category": "visual_spasial", "percentage": 90}, {"name": "Kinestetik", "score": 8, "total": 10, "category": "kinestetik", "percentage": 80}, {"name": "Musik", "score": 7, "total": 10, "category": "musik", "percentage": 70}], "profilKecerdasanLengkap": [{"skor": 9, "total": 10, "dimensi": "Visual Spasial", "ranking": 1, "kategori": "Tinggi", "persentase": 90, "rekomendasi": ["Gunakan mind map dan diagram saat belajar", "Manfaatkan media visual seperti gambar dan video", "Praktikkan aktivitas seni dan design", "Latih kemampuan navigasi dan orientasi ruang"]}, {"skor": 8, "total": 10, "dimensi": "Kinestetik", "ranking": 2, "kategori": "Tinggi", "persentase": 80, "rekomendasi": ["Integrasikan gerakan dalam proses belajar", "Ikuti aktivitas olahraga dan tari", "Praktikkan pembelajaran hands-on", "Gunakan role-play dan simulasi"]}, {"skor": 7, "total": 10, "dimensi": "Musik", "ranking": 3, "kategori": "Tinggi", "persentase": 70, "rekomendasi": ["Gunakan lagu untuk mengingat informasi", "Pelajari alat musik", "Ikuti aktivitas bernyanyi atau paduan suara", "Manfaatkan ritme dalam pembelajaran"]}, {"skor": 6, "total": 10, "dimensi": "Intrapersonal", "ranking": 4, "kategori": "Sedang", "persentase": 60, "rekomendasi": ["Luangkan waktu untuk refleksi diri", "Latih journaling dan self-assessment", "Praktikkan mindfulness dan meditasi", "Tentukan tujuan personal yang jelas"]}, {"skor": 3, "total": 10, "dimensi": "Linguistik", "ranking": 5, "kategori": "Rendah", "persentase": 30, "rekomendasi": ["Perbanyak membaca dan menulis", "Latih public speaking dan storytelling", "Pelajari bahasa asing", "Ikuti aktivitas debat dan diskusi"]}, {"skor": 3, "total": 10, "dimensi": "Logis Matematis", "ranking": 6, "kategori": "Rendah", "persentase": 30, "rekomendasi": ["Latih kemampuan problem solving", "Pelajari programming dan logika", "Mainkan game strategi dan puzzle", "Praktikkan metode ilmiah dalam berpikir"]}, {"skor": 2, "total": 10, "dimensi": "Interpersonal", "ranking": 7, "kategori": "Rendah", "persentase": 20, "rekomendasi": ["Ikuti kegiatan kelompok dan teamwork", "Praktikkan empati dan komunikasi", "Latih kemampuan leadership", "Terlibat dalam aktivitas sosial dan volunteer"]}]}	2026-03-03 08:41:35.43	2026-03-03 08:34:53.987797
154	d_g-3GaM0rMl	9	323	purchased	\N	\N	2026-03-27 09:48:19.504574
122	qmTM5EUv-VeC	9	286	completed	{"ranking": [{"name": "Visual Spasial", "score": 10, "total": 10, "category": "visual_spasial", "percentage": 100}, {"name": "Linguistik", "score": 10, "total": 10, "category": "linguistik", "percentage": 100}, {"name": "Logis Matematis", "score": 10, "total": 10, "category": "logis_matematis", "percentage": 100}, {"name": "Musik", "score": 10, "total": 10, "category": "musik", "percentage": 100}, {"name": "Interpersonal", "score": 8, "total": 10, "category": "interpersonal", "percentage": 80}, {"name": "Intrapersonal", "score": 5, "total": 10, "category": "intrapersonal", "percentage": 50}, {"name": "Kinestetik", "score": 4, "total": 10, "category": "kinestetik", "percentage": 40}], "responses": {"1": true, "2": true, "3": true, "4": true, "5": true, "6": true, "7": true, "8": true, "9": true, "10": true, "11": true, "12": true, "13": true, "14": true, "15": true, "16": true, "17": true, "18": true, "19": true, "20": true, "21": true, "22": true, "23": true, "24": true, "25": true, "26": true, "27": true, "28": true, "29": true, "30": true, "31": true, "32": false, "33": false, "34": false, "35": false, "36": false, "37": false, "38": true, "39": true, "40": true, "41": true, "42": true, "43": true, "44": true, "45": true, "46": true, "47": true, "48": true, "49": true, "50": true, "51": true, "52": true, "53": true, "54": true, "55": true, "56": true, "57": true, "58": true, "59": false, "60": false, "61": false, "62": false, "63": false, "64": false, "65": false, "66": true, "67": true, "68": true, "69": true, "70": true}, "completedAt": "2025-09-24T11:11:33.875Z", "percentages": {"musik": 100, "kinestetik": 40, "linguistik": 100, "interpersonal": 80, "intrapersonal": 50, "visual_spasial": 100, "logis_matematis": 100}, "categoryScores": [{"name": "Visual Spasial", "score": 10, "total": 10, "category": "visual_spasial", "percentage": 100}, {"name": "Linguistik", "score": 10, "total": 10, "category": "linguistik", "percentage": 100}, {"name": "Logis Matematis", "score": 10, "total": 10, "category": "logis_matematis", "percentage": 100}, {"name": "Musik", "score": 10, "total": 10, "category": "musik", "percentage": 100}, {"name": "Interpersonal", "score": 8, "total": 10, "category": "interpersonal", "percentage": 80}, {"name": "Intrapersonal", "score": 5, "total": 10, "category": "intrapersonal", "percentage": 50}, {"name": "Kinestetik", "score": 4, "total": 10, "category": "kinestetik", "percentage": 40}], "participantInfo": {}, "scoresByCategory": {"musik": {"score": 10, "total": 10, "percentage": 100}, "kinestetik": {"score": 4, "total": 10, "percentage": 40}, "linguistik": {"score": 10, "total": 10, "percentage": 100}, "interpersonal": {"score": 8, "total": 10, "percentage": 80}, "intrapersonal": {"score": 5, "total": 10, "percentage": 50}, "visual_spasial": {"score": 10, "total": 10, "percentage": 100}, "logis_matematis": {"score": 10, "total": 10, "percentage": 100}}, "dominantIntelligences": [{"name": "Visual Spasial", "score": 10, "total": 10, "category": "visual_spasial", "percentage": 100}, {"name": "Linguistik", "score": 10, "total": 10, "category": "linguistik", "percentage": 100}, {"name": "Logis Matematis", "score": 10, "total": 10, "category": "logis_matematis", "percentage": 100}], "profilKecerdasanLengkap": [{"skor": 10, "total": 10, "dimensi": "Visual Spasial", "ranking": 1, "kategori": "Tinggi", "persentase": 100, "rekomendasi": ["Gunakan mind map dan diagram saat belajar", "Manfaatkan media visual seperti gambar dan video", "Praktikkan aktivitas seni dan design", "Latih kemampuan navigasi dan orientasi ruang"]}, {"skor": 10, "total": 10, "dimensi": "Linguistik", "ranking": 2, "kategori": "Tinggi", "persentase": 100, "rekomendasi": ["Perbanyak membaca dan menulis", "Latih public speaking dan storytelling", "Pelajari bahasa asing", "Ikuti aktivitas debat dan diskusi"]}, {"skor": 10, "total": 10, "dimensi": "Logis Matematis", "ranking": 3, "kategori": "Tinggi", "persentase": 100, "rekomendasi": ["Latih kemampuan problem solving", "Pelajari programming dan logika", "Mainkan game strategi dan puzzle", "Praktikkan metode ilmiah dalam berpikir"]}, {"skor": 10, "total": 10, "dimensi": "Musik", "ranking": 4, "kategori": "Tinggi", "persentase": 100, "rekomendasi": ["Gunakan lagu untuk mengingat informasi", "Pelajari alat musik", "Ikuti aktivitas bernyanyi atau paduan suara", "Manfaatkan ritme dalam pembelajaran"]}, {"skor": 8, "total": 10, "dimensi": "Interpersonal", "ranking": 5, "kategori": "Tinggi", "persentase": 80, "rekomendasi": ["Ikuti kegiatan kelompok dan teamwork", "Praktikkan empati dan komunikasi", "Latih kemampuan leadership", "Terlibat dalam aktivitas sosial dan volunteer"]}, {"skor": 5, "total": 10, "dimensi": "Intrapersonal", "ranking": 6, "kategori": "Sedang", "persentase": 50, "rekomendasi": ["Luangkan waktu untuk refleksi diri", "Latih journaling dan self-assessment", "Praktikkan mindfulness dan meditasi", "Tentukan tujuan personal yang jelas"]}, {"skor": 4, "total": 10, "dimensi": "Kinestetik", "ranking": 7, "kategori": "Sedang", "persentase": 40, "rekomendasi": ["Integrasikan gerakan dalam proses belajar", "Ikuti aktivitas olahraga dan tari", "Praktikkan pembelajaran hands-on", "Gunakan role-play dan simulasi"]}]}	2025-09-24 11:11:33.876	2025-09-21 07:10:55.536536
125	1LW9p5YZYUbW	9	289	completed	{"ranking": [{"name": "Visual Spasial", "score": 7, "total": 10, "category": "visual_spasial", "percentage": 70}, {"name": "Linguistik", "score": 0, "total": 10, "category": "linguistik", "percentage": 0}, {"name": "Logis Matematis", "score": 0, "total": 10, "category": "logis_matematis", "percentage": 0}, {"name": "Kinestetik", "score": 0, "total": 10, "category": "kinestetik", "percentage": 0}, {"name": "Musik", "score": 0, "total": 10, "category": "musik", "percentage": 0}, {"name": "Interpersonal", "score": 0, "total": 10, "category": "interpersonal", "percentage": 0}, {"name": "Intrapersonal", "score": 0, "total": 10, "category": "intrapersonal", "percentage": 0}], "responses": {"1": false, "2": false, "3": false, "4": true, "5": true, "6": true, "7": true, "8": true, "9": true, "10": true, "11": false, "12": false, "13": false, "14": false, "15": false, "16": false, "17": false, "18": false, "19": false, "20": false, "21": false, "22": false, "23": false, "24": false, "25": false, "26": false, "27": false, "28": false, "29": false, "30": false, "31": false, "32": false, "33": false, "34": false, "35": false, "36": false, "37": false, "38": false, "39": false, "40": false, "41": false, "42": false, "43": false, "44": false, "45": false, "46": false, "47": false, "48": false, "49": false, "50": false, "51": false, "52": false, "53": false, "54": false, "55": false, "56": false, "57": false, "58": false, "59": false, "60": false, "61": false, "62": false, "63": false, "64": false, "65": false, "66": false, "67": false, "68": false, "69": false, "70": false}, "completedAt": "2025-09-24T11:39:40.899Z", "percentages": {"musik": 0, "kinestetik": 0, "linguistik": 0, "interpersonal": 0, "intrapersonal": 0, "visual_spasial": 70, "logis_matematis": 0}, "categoryScores": [{"name": "Visual Spasial", "score": 7, "total": 10, "category": "visual_spasial", "percentage": 70}, {"name": "Linguistik", "score": 0, "total": 10, "category": "linguistik", "percentage": 0}, {"name": "Logis Matematis", "score": 0, "total": 10, "category": "logis_matematis", "percentage": 0}, {"name": "Kinestetik", "score": 0, "total": 10, "category": "kinestetik", "percentage": 0}, {"name": "Musik", "score": 0, "total": 10, "category": "musik", "percentage": 0}, {"name": "Interpersonal", "score": 0, "total": 10, "category": "interpersonal", "percentage": 0}, {"name": "Intrapersonal", "score": 0, "total": 10, "category": "intrapersonal", "percentage": 0}], "participantInfo": {}, "scoresByCategory": {"musik": {"score": 0, "total": 10, "percentage": 0}, "kinestetik": {"score": 0, "total": 10, "percentage": 0}, "linguistik": {"score": 0, "total": 10, "percentage": 0}, "interpersonal": {"score": 0, "total": 10, "percentage": 0}, "intrapersonal": {"score": 0, "total": 10, "percentage": 0}, "visual_spasial": {"score": 7, "total": 10, "percentage": 70}, "logis_matematis": {"score": 0, "total": 10, "percentage": 0}}, "dominantIntelligences": [{"name": "Visual Spasial", "score": 7, "total": 10, "category": "visual_spasial", "percentage": 70}, {"name": "Linguistik", "score": 0, "total": 10, "category": "linguistik", "percentage": 0}, {"name": "Logis Matematis", "score": 0, "total": 10, "category": "logis_matematis", "percentage": 0}], "profilKecerdasanLengkap": [{"skor": 7, "total": 10, "dimensi": "Visual Spasial", "ranking": 1, "kategori": "Tinggi", "persentase": 70, "rekomendasi": ["Gunakan mind map dan diagram saat belajar", "Manfaatkan media visual seperti gambar dan video", "Praktikkan aktivitas seni dan design", "Latih kemampuan navigasi dan orientasi ruang"]}, {"skor": 0, "total": 10, "dimensi": "Linguistik", "ranking": 2, "kategori": "Rendah", "persentase": 0, "rekomendasi": ["Perbanyak membaca dan menulis", "Latih public speaking dan storytelling", "Pelajari bahasa asing", "Ikuti aktivitas debat dan diskusi"]}, {"skor": 0, "total": 10, "dimensi": "Logis Matematis", "ranking": 3, "kategori": "Rendah", "persentase": 0, "rekomendasi": ["Latih kemampuan problem solving", "Pelajari programming dan logika", "Mainkan game strategi dan puzzle", "Praktikkan metode ilmiah dalam berpikir"]}, {"skor": 0, "total": 10, "dimensi": "Kinestetik", "ranking": 4, "kategori": "Rendah", "persentase": 0, "rekomendasi": ["Integrasikan gerakan dalam proses belajar", "Ikuti aktivitas olahraga dan tari", "Praktikkan pembelajaran hands-on", "Gunakan role-play dan simulasi"]}, {"skor": 0, "total": 10, "dimensi": "Musik", "ranking": 5, "kategori": "Rendah", "persentase": 0, "rekomendasi": ["Gunakan lagu untuk mengingat informasi", "Pelajari alat musik", "Ikuti aktivitas bernyanyi atau paduan suara", "Manfaatkan ritme dalam pembelajaran"]}, {"skor": 0, "total": 10, "dimensi": "Interpersonal", "ranking": 6, "kategori": "Rendah", "persentase": 0, "rekomendasi": ["Ikuti kegiatan kelompok dan teamwork", "Praktikkan empati dan komunikasi", "Latih kemampuan leadership", "Terlibat dalam aktivitas sosial dan volunteer"]}, {"skor": 0, "total": 10, "dimensi": "Intrapersonal", "ranking": 7, "kategori": "Rendah", "persentase": 0, "rekomendasi": ["Luangkan waktu untuk refleksi diri", "Latih journaling dan self-assessment", "Praktikkan mindfulness dan meditasi", "Tentukan tujuan personal yang jelas"]}]}	2025-09-24 11:39:40.899	2025-09-24 11:12:45.297954
124	i9i4_VwSRTck	9	288	completed	{"ranking": [{"name": "Visual Spasial", "score": 10, "total": 10, "category": "visual_spasial", "percentage": 100}, {"name": "Linguistik", "score": 10, "total": 10, "category": "linguistik", "percentage": 100}, {"name": "Logis Matematis", "score": 10, "total": 10, "category": "logis_matematis", "percentage": 100}, {"name": "Kinestetik", "score": 10, "total": 10, "category": "kinestetik", "percentage": 100}, {"name": "Musik", "score": 10, "total": 10, "category": "musik", "percentage": 100}, {"name": "Interpersonal", "score": 10, "total": 10, "category": "interpersonal", "percentage": 100}, {"name": "Intrapersonal", "score": 10, "total": 10, "category": "intrapersonal", "percentage": 100}], "responses": {"1": true, "2": true, "3": true, "4": true, "5": true, "6": true, "7": true, "8": true, "9": true, "10": true, "11": true, "12": true, "13": true, "14": true, "15": true, "16": true, "17": true, "18": true, "19": true, "20": true, "21": true, "22": true, "23": true, "24": true, "25": true, "26": true, "27": true, "28": true, "29": true, "30": true, "31": true, "32": true, "33": true, "34": true, "35": true, "36": true, "37": true, "38": true, "39": true, "40": true, "41": true, "42": true, "43": true, "44": true, "45": true, "46": true, "47": true, "48": true, "49": true, "50": true, "51": true, "52": true, "53": true, "54": true, "55": true, "56": true, "57": true, "58": true, "59": true, "60": true, "61": true, "62": true, "63": true, "64": true, "65": true, "66": true, "67": true, "68": true, "69": true, "70": true}, "completedAt": "2025-09-29T04:38:56.990Z", "percentages": {"musik": 100, "kinestetik": 100, "linguistik": 100, "interpersonal": 100, "intrapersonal": 100, "visual_spasial": 100, "logis_matematis": 100}, "categoryScores": [{"name": "Visual Spasial", "score": 10, "total": 10, "category": "visual_spasial", "percentage": 100}, {"name": "Linguistik", "score": 10, "total": 10, "category": "linguistik", "percentage": 100}, {"name": "Logis Matematis", "score": 10, "total": 10, "category": "logis_matematis", "percentage": 100}, {"name": "Kinestetik", "score": 10, "total": 10, "category": "kinestetik", "percentage": 100}, {"name": "Musik", "score": 10, "total": 10, "category": "musik", "percentage": 100}, {"name": "Interpersonal", "score": 10, "total": 10, "category": "interpersonal", "percentage": 100}, {"name": "Intrapersonal", "score": 10, "total": 10, "category": "intrapersonal", "percentage": 100}], "participantInfo": {}, "scoresByCategory": {"musik": {"score": 10, "total": 10, "percentage": 100}, "kinestetik": {"score": 10, "total": 10, "percentage": 100}, "linguistik": {"score": 10, "total": 10, "percentage": 100}, "interpersonal": {"score": 10, "total": 10, "percentage": 100}, "intrapersonal": {"score": 10, "total": 10, "percentage": 100}, "visual_spasial": {"score": 10, "total": 10, "percentage": 100}, "logis_matematis": {"score": 10, "total": 10, "percentage": 100}}, "dominantIntelligences": [{"name": "Visual Spasial", "score": 10, "total": 10, "category": "visual_spasial", "percentage": 100}, {"name": "Linguistik", "score": 10, "total": 10, "category": "linguistik", "percentage": 100}, {"name": "Logis Matematis", "score": 10, "total": 10, "category": "logis_matematis", "percentage": 100}], "profilKecerdasanLengkap": [{"skor": 10, "total": 10, "dimensi": "Visual Spasial", "ranking": 1, "kategori": "Tinggi", "persentase": 100, "rekomendasi": ["Gunakan mind map dan diagram saat belajar", "Manfaatkan media visual seperti gambar dan video", "Praktikkan aktivitas seni dan design", "Latih kemampuan navigasi dan orientasi ruang"]}, {"skor": 10, "total": 10, "dimensi": "Linguistik", "ranking": 2, "kategori": "Tinggi", "persentase": 100, "rekomendasi": ["Perbanyak membaca dan menulis", "Latih public speaking dan storytelling", "Pelajari bahasa asing", "Ikuti aktivitas debat dan diskusi"]}, {"skor": 10, "total": 10, "dimensi": "Logis Matematis", "ranking": 3, "kategori": "Tinggi", "persentase": 100, "rekomendasi": ["Latih kemampuan problem solving", "Pelajari programming dan logika", "Mainkan game strategi dan puzzle", "Praktikkan metode ilmiah dalam berpikir"]}, {"skor": 10, "total": 10, "dimensi": "Kinestetik", "ranking": 4, "kategori": "Tinggi", "persentase": 100, "rekomendasi": ["Integrasikan gerakan dalam proses belajar", "Ikuti aktivitas olahraga dan tari", "Praktikkan pembelajaran hands-on", "Gunakan role-play dan simulasi"]}, {"skor": 10, "total": 10, "dimensi": "Musik", "ranking": 5, "kategori": "Tinggi", "persentase": 100, "rekomendasi": ["Gunakan lagu untuk mengingat informasi", "Pelajari alat musik", "Ikuti aktivitas bernyanyi atau paduan suara", "Manfaatkan ritme dalam pembelajaran"]}, {"skor": 10, "total": 10, "dimensi": "Interpersonal", "ranking": 6, "kategori": "Tinggi", "persentase": 100, "rekomendasi": ["Ikuti kegiatan kelompok dan teamwork", "Praktikkan empati dan komunikasi", "Latih kemampuan leadership", "Terlibat dalam aktivitas sosial dan volunteer"]}, {"skor": 10, "total": 10, "dimensi": "Intrapersonal", "ranking": 7, "kategori": "Tinggi", "persentase": 100, "rekomendasi": ["Luangkan waktu untuk refleksi diri", "Latih journaling dan self-assessment", "Praktikkan mindfulness dan meditasi", "Tentukan tujuan personal yang jelas"]}]}	2025-09-29 04:38:56.99	2025-09-22 01:24:01.893479
132	Zqr6APIHPrjp	7	298	completed	{"patterns": {"A": "typical", "B": "typical", "C": "typical", "D": "typical", "E": "typical", "F": "hypersensitive", "G": "hypersensitive", "H": "hypersensitive", "I": "hypersensitive", "J": "hypersensitive", "K": "hypersensitive", "L": "typical"}, "responses": {"1": "2", "2": "4", "3": "3", "4": "2", "5": "3", "6": "2", "7": "3", "8": "2", "9": "3", "10": "2", "11": "4", "12": "5", "13": "4", "14": "5", "15": "3", "16": "4", "17": "5", "18": "4", "19": "4", "20": "4", "21": "4", "22": "5", "23": "4", "24": "3", "25": "2", "26": "1", "27": "5", "28": "4", "29": "3", "30": "2", "31": "5", "32": "4", "33": "4", "34": "3", "35": "2", "36": "3", "37": "2", "38": "4", "39": "4", "40": "4", "41": "4", "42": "5", "43": "4", "44": "4", "45": "4", "46": "4", "47": "3", "48": "4", "49": "4", "50": "4", "51": "4", "52": "3", "53": "2", "54": "5", "55": "4", "56": "4", "57": "4", "58": "4", "59": "5", "60": "5", "61": "4", "62": "5", "63": "4", "64": "4", "65": "5", "66": "4", "67": "5", "68": "5", "69": "4", "70": "4", "71": "5", "72": "4", "73": "5", "74": "4", "75": "5", "76": "5", "77": "5", "78": "5", "79": "5", "80": "5", "81": "5", "82": "4", "83": "3", "84": "4", "85": "3", "86": "5", "87": "4", "88": "5", "89": "5", "90": "5", "91": "5", "92": "5", "93": "5", "94": "5", "95": "5", "96": "4", "97": "5", "98": "5", "99": "5", "100": "5", "101": "5", "102": "4", "103": "3", "104": "2", "105": "5", "106": "4", "107": "5", "108": "2", "109": "3", "110": "4", "111": "4", "112": "3", "113": "2", "114": "5", "115": "4", "116": "3", "117": "2", "118": "5", "119": "4", "120": "3", "121": "4", "122": "5", "123": "4", "124": "3", "125": "5"}, "totalScore": 493, "completedAt": "2025-10-06T11:07:01.463Z", "averageScore": "3.94", "sectionScores": {"A": {"count": 8, "total": 21, "average": "2.63"}, "B": {"count": 9, "total": 35, "average": "3.89"}, "C": {"count": 11, "total": 40, "average": "3.64"}, "D": {"count": 18, "total": 65, "average": "3.61"}, "E": {"count": 7, "total": 24, "average": "3.43"}, "F": {"count": 12, "total": 53, "average": "4.42"}, "G": {"count": 9, "total": 40, "average": "4.44"}, "H": {"count": 10, "total": 46, "average": "4.60"}, "I": {"count": 7, "total": 32, "average": "4.57"}, "J": {"count": 4, "total": 20, "average": "5.00"}, "K": {"count": 4, "total": 19, "average": "4.75"}, "L": {"count": 26, "total": 98, "average": "3.77"}}, "totalResponses": 125, "participantInfo": {"testDate": "2025-10-06", "childName": "Anastasia", "parentName": "Vina", "relationship": "Ibu", "childBirthDate": "2014-04-07"}}	2025-10-06 11:07:01.463	2025-10-06 10:37:26.790931
149	aCBnJE-nuzqq	7	315	completed	{"patterns": {"A": "hypersensitive", "B": "hypersensitive", "C": "typical", "D": "typical", "E": "typical", "F": "hyposensitive", "G": "typical", "H": "typical", "I": "typical", "J": "typical", "K": "typical", "L": "typical"}, "responses": {"1": "5", "2": "5", "3": "4", "4": "4", "5": "4", "6": "4", "7": "4", "8": "4", "9": "4", "10": "4", "11": "5", "12": "4", "13": "4", "14": "4", "15": "5", "16": "4", "17": "4", "18": "5", "19": "5", "20": "5", "21": "5", "22": "5", "23": "5", "24": "2", "25": "1", "26": "2", "27": "2", "28": "2", "29": "4", "30": "4", "31": "4", "32": "4", "33": "4", "34": "4", "35": "3", "36": "4", "37": "3", "38": "2", "39": "2", "40": "2", "41": "5", "42": "4", "43": "4", "44": "2", "45": "2", "46": "2", "47": "2", "48": "2", "49": "2", "50": "2", "51": "4", "52": "5", "53": "2", "54": "3", "55": "2", "56": "1", "57": "1", "58": "2", "59": "2", "60": "2", "61": "2", "62": "2", "63": "1", "64": "2", "65": "2", "66": "2", "67": "3", "68": "3", "69": "3", "70": "3", "71": "4", "72": "4", "73": "3", "74": "3", "75": "3", "76": "4", "77": "3", "78": "4", "79": "4", "80": "4", "81": "4", "82": "4", "83": "4", "84": "4", "85": "4", "86": "2", "87": "2", "88": "3", "89": "3", "90": "3", "91": "4", "92": "3", "93": "4", "94": "3", "95": "3", "96": "4", "97": "4", "98": "4", "99": "3", "100": "3", "101": "4", "102": "4", "103": "4", "104": "4", "105": "3", "106": "3", "107": "5", "108": "2", "109": "2", "110": "1", "111": "3", "112": "3", "113": "5", "114": "2", "115": "1", "116": "3", "117": "1", "118": "1", "119": "2", "120": "4", "121": "3", "122": "4", "123": "4", "124": "2", "125": "3"}, "totalScore": 402, "completedAt": "2026-03-28T01:38:10.034Z", "averageScore": "3.22", "sectionScores": {"A": {"count": 8, "total": 34, "average": "4.25"}, "B": {"count": 9, "total": 38, "average": "4.22"}, "C": {"count": 11, "total": 39, "average": "3.55"}, "D": {"count": 18, "total": 59, "average": "3.28"}, "E": {"count": 7, "total": 19, "average": "2.71"}, "F": {"count": 12, "total": 22, "average": "1.83"}, "G": {"count": 9, "total": 28, "average": "3.11"}, "H": {"count": 10, "total": 38, "average": "3.80"}, "I": {"count": 7, "total": 21, "average": "3.00"}, "J": {"count": 4, "total": 13, "average": "3.25"}, "K": {"count": 4, "total": 15, "average": "3.75"}, "L": {"count": 26, "total": 76, "average": "2.92"}}, "totalResponses": 125, "participantInfo": {"testDate": "2026-03-28", "childName": "Aleena", "parentName": "Ajeng", "relationship": "Wali", "childBirthDate": "2020-03-30"}}	2026-03-28 01:38:10.034	2026-02-19 09:03:08.505534
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, email, first_name, last_name, profile_image_url, created_at, updated_at, password, whatsapp_number, is_email_verified, auth_provider, role, is_active, last_login_at) FROM stdin;
wJCU6NoZ5-PA	witasari.ismintarum78@gmail.com	Witasari 	Ismintarum	\N	2025-09-08 00:26:37.865972	2025-12-09 01:24:31.769	$2b$12$OFDQxzh18GKoyzFmrfGGpOa10EIexJ.0oiT7JsNXouwcBqeS.E5Ki	628122779224	t	custom	admin	t	\N
VQ0EyVNRZ9Cq	pt.nastiti@gmail.com	Pamuji	Tri Nastiti	\N	2025-10-04 02:08:35.337405	2025-10-06 10:44:30.785	$2b$12$InWBht/9zBF91aoLPrRWxOFegG5N1OuZf2hSfPi68NQPwvH18z2RK	628157965254	t	custom	internal	t	\N
DnFOQaFdVzSH	meilitachristiamadea@gmail.com	Meilita Christi	Amadea	\N	2025-10-04 02:10:28.493071	2025-10-06 10:44:38.799	$2b$12$8KiSQxlBZk7ApzqrNSMsqOtgE38zegUHCXSeMJH.G.lQj4a21JKSe	6283869705004	t	custom	internal	t	\N
Nz0YaiuDTaoH	rretno033@gmail.com	Retno	Rahayu	\N	2025-09-08 00:31:09.902245	2025-10-06 11:18:02.199	$2b$12$6MsYo92QDUb56XBu1B2Bb./8TXMysbT26tfM12UQTNkWqq7Ks6fMW	6282223605170	t	custom	internal	t	2025-10-07 02:10:43.77
YO-DHnVAZRWG	monika.anggraeni@gmail.com	Monica	Violin	\N	2025-10-04 08:49:40.606802	2025-10-06 10:44:46.087	$2b$12$seF7qKs0N0thgfkxlRWUeuur/yn.avGxHzxPgMdJ8PetFvBylL3DC	6285643628639	t	custom	internal	t	2025-10-04 08:51:42.972
Zqr6APIHPrjp	tommy@yis-edu.org	Tommy	Sigit	\N	2025-10-04 14:00:49.821913	2025-10-06 10:39:01.613	$2b$12$U04Z9SHaXAdhcpncnkCgc.UP4cNW2zPMt36vTjfAW4FmYxvwXzIGG	628812715451	t	custom	internal	t	2025-10-06 10:45:18.523
EZgmzjFlq74D	madinaagnia1004@gmail.com	Madina	Agnia	\N	2025-10-18 14:38:02.015708	2025-12-08 09:34:39.681	$2b$12$v94yW0GDAQBXHLSGQoHJwuEgEjL6d6vKgiYbVS90rIb.qTpA/QJke	62811344618	t	custom	internal	t	\N
T1gm3pG2h_o0	tsn@tressolis.com	Tres Solis	Nusantara	\N	2025-08-22 06:42:11.07399	2025-12-09 01:24:03.168	$2b$12$I4aRDvSFxO2dvnHq6S5zgeI2WxSh1RoQ8oXDvN5ftFGfU5fPCCEQW	628812715451	t	custom	admin	t	2025-10-07 02:35:36.911
IqO9IlNVqHch	tommysigit@gmail.com	Tommy	Sigit	\N	2025-07-24 09:09:03.310961	2025-10-06 11:17:13.085	$2b$12$u2mGrwDSuOCE4OZYU0t8zeXFqOM5h5MWYsBm5LrOowsaDFC4.cP2O	628812715451	t	custom	admin	t	2026-04-18 05:05:50.138
90J9vQQbOwmG	sutansaja@gmail.com	Sutan	Hartanto	\N	2025-09-08 01:26:47.375923	2025-10-06 11:18:14.427	$2b$12$vKoMaYx9j6JDiNj3TDY/PuhS5lxpsVAVIA4QAByuIy5qHzZVWIomC	6281228805105	t	custom	internal	t	\N
jKRKMaDheZIH	dindit@yis-edu.org	Elia	Nugraha	\N	2025-09-24 11:40:42.586078	2025-10-06 11:18:27.268	$2b$12$z78b.97w.4JS14iP9/1diu8R.uKP7HOexbLdAwo1Wk2TQf/7rg4Wa	628811470704	t	custom	internal	t	\N
qmTM5EUv-VeC	dindit@gmail.com	Elia	Ekanindita	\N	2025-07-24 09:04:55.681813	2025-08-22 06:48:40.946	$2b$12$//GD0ZMHtZsWHGM90bguP.lqGdlP47Ppw/mjwP1MSwQSB7/AB9Cw2	628122692315	t	custom	admin	t	2025-09-24 11:08:29.693
90IRpTsRLVfE	kzadt97@gmail.com	Kezia	A	\N	2025-08-23 05:15:43.515777	2025-12-09 01:24:15.317	$2b$12$ieJ7IpuO8Zi/zXxv4/kkjOWQBhB0/nKiUSYjEfXjxWSd5GElUQcUi	6285643226339	t	custom	admin	t	2025-10-07 02:06:35.113
1LW9p5YZYUbW	dindit@me.com	Aile	Ahargun	\N	2025-09-24 11:12:36.103479	2025-09-24 11:12:36.103479	$2b$12$3MZWn1XSw6uRFDngalKuW.2haaNvfcDDWNT6ay4qDeXLaUZ/PSL12	628811470704	t	custom	user	t	2025-09-24 11:36:03.478
i9i4_VwSRTck	testing@gmail.com	Percobaan	Saja	\N	2025-09-22 01:23:47.674116	2025-09-22 01:23:47.674116	$2b$12$9nRhrvabZPXhWEa.tHyThuAYc539l7e99m.waBPIuJDXfTur5Tnb.	62889320103	t	custom	user	t	2025-09-29 04:35:56.983
djMeUTfd0gLM	putrianeswariz@gmail.com	Alizaky	Indra Prabowo 	\N	2025-10-17 09:16:08.573164	2025-10-20 10:27:52.572	$2b$12$lNtmevzXs7XueNujopZhYOBN.74Esy6N2u2e0IggrXb33ThIpv9Oa	6281252523306	t	custom	internal	t	\N
MNWv_X5sPskg	faustina.angrlina@gmail.com	Angelina	Ganis	\N	2025-10-15 02:42:52.919081	2025-10-17 07:20:50.563	$2b$12$cwJ4kJLhwxiEegp63qcHFeNsL2Til0lvwsnE5X7ReYQFYVSM9BVZi	6281917390459	t	custom	internal	t	\N
IWtHul480Iyk	zianazakiah828@gmail.com	Ziana	Zakiah	\N	2025-10-15 02:48:51.267699	2025-10-17 07:20:58.042	$2b$12$m36WKvjsd6s2PV2pmb.m0udB3kZ7F5/65pt6yuEkF5MOKiH12AMiW	6285842155208	t	custom	internal	t	\N
au5yUYEa_S2I	ahzia68@gmail.com	Inggit	Fauziyah	\N	2025-10-15 03:34:01.013068	2025-10-17 07:21:04.254	$2b$12$JQ.E6XdsPJnROzr11DXdT.IF4DLnKIgVbmJ70vhVZeh2k4wXeh9IK	6285694532270	t	custom	internal	t	\N
sbOgsxPIaIo7	apramusita30@gmail.com	Anggita	Ajeng Pramusita	\N	2025-10-17 07:08:11.086822	2025-10-17 07:21:12.68	$2b$12$qCT1boSD/qhQvPbBMbIltek4BbvA8JZm8slj09rrCD9l1On7l4LLq	6285725230613	t	custom	internal	t	\N
X4cFdXheGhZO	pelangi@camenia.com	Pelangi	Indonesia	\N	2025-08-23 07:08:07.092091	2025-08-23 07:08:57.999	$2b$12$exa.6VUNAcWqLiliWvcMFufjcRFx1vXhENxwCa3UkpqsdbEEabwEG	6281991466546	t	custom	admin	t	2026-03-28 01:39:44.65
9wZHAapaLS1o	rianagustina48@admin.paud.belajar.id	Rian	Agustina	\N	2025-10-07 02:03:00.762051	2025-10-08 04:07:00.934	$2b$10$n/R2gZvmxu/9FvUwS4lttOvtx54qjkwsmQuLm1hlA1f3glVP2RHB.	6285292198898	t	custom	internal	t	2025-10-08 04:44:13.57
nU3GVbt1RrLl	nuraeniika8@gmail.com	Ika	Nur Aeni	\N	2025-10-20 02:37:48.064224	2025-10-28 02:17:16.767	$2b$12$Fm3Fcd23MVXLZflQpyNpcez3sT/HcRhZBFmZxlUXRv7IBrwAs0ysu	6289673386197	t	custom	internal	t	\N
asUZUJgkYEP5	laksmiwurianggraeni@gmail.com	Laksmi. W	Anggraeni	\N	2025-10-17 09:23:17.870615	2025-10-20 10:28:03.942	$2b$12$.5JL2VN9ojQ3uJrlS4oYmeIQAJLSka3bPeATOJ3mCv/vKkKQwsXci	6285228823062	t	custom	internal	t	\N
c_WezgTVt78L	fsatyadewi39@gmail.com	Flavianus	Bernard	\N	2025-10-17 09:26:33.643574	2025-10-20 10:28:26.903	$2b$12$0AjE1PXmClYx1iG8v8QydOfX4D6mYS9uWlLTZssU5.W2YagOP1Pkq	6288232106014	t	custom	internal	t	\N
SnkcYsNLv5OB	keumbeebungoeng@gmail.com	Jayden	Malinowski Combe	\N	2025-10-17 09:36:23.717146	2025-10-20 10:28:35.995	$2b$12$.tsse00Fq.LYYzbra/ZqAefEXrWSn0n8wnKYHCx0v0HwGFteTEEU2	6281990375200	t	custom	internal	t	\N
lLWaH8rm_w34	trimurdiatismkn7@gmail.com	Tri	Murdiati	\N	2025-10-17 09:44:17.964439	2025-10-20 10:29:04.645	$2b$12$4rIJ1Is6KbDkTl8IMrsO6ezC3enKR4nqLJmwXc0xjdtb/ARO6GF.i	628122770671	t	custom	internal	t	\N
MtCmbJm1Hj-H	ignacia84@gmail.com	Arkadipta	Adipadmana	\N	2025-10-19 01:36:25.899699	2025-10-20 10:29:38.981	$2b$12$F3cXq/nctIP912U4JfK32eJl8TLcze46sgqc1sXxOzuT5JzloLacy	628995135746	t	custom	internal	t	\N
bJDjVEpQSNCl	febricaria@gmail.com	Hamiida	Febricaria	\N	2025-10-17 09:09:36.29847	2025-10-20 10:30:59.99	$2b$12$cFnJpxiTa0GDgQFcumKZYOJiLCrQtIWikTbu1XUkchi.S72mHyuzy	6282226246622	t	custom	internal	t	\N
cprMqS6EVwkf	anisahshintarini14@gmail.com	Anisah Devi 	Shintarini	\N	2025-10-17 09:11:31.488553	2025-10-20 10:31:08.327	$2b$12$UdD2XHZleT5RcgheL2./3.SSy57LpOAfp2ymgC3lZWyAhxyuAQ2Ey	6285877535444	t	custom	internal	t	\N
JMGk2hu71-ZQ	devi.rj42@gmail.com	Devi	Rosalina	\N	2025-10-17 11:07:36.98511	2025-10-20 10:31:34.759	$2b$12$wsbNSUDb5Q5376orgpL.luNzg1UuLph4VgG3r94DjkZCyDxC74P/i	6287765270126	t	custom	internal	t	2025-10-17 11:57:34.214
G5Ll3XdZcH1u	haryati.susanto@icloud.com	Danendra 	Atharizz	\N	2025-10-20 02:38:31.331424	2025-10-28 02:17:21.939	$2b$12$M1dEuDc5KpqBookoXxrNDeg449a17Qh2OS3GQnTg4YKGGje1dffmG	6282221051744	t	custom	internal	t	\N
oipcUpZlBMOB	helenajovita8@gmail.com	Nathania	Lituhayu	\N	2025-10-20 03:08:14.672764	2025-10-28 02:17:26.769	$2b$12$w4GAhtCi9yqQKHIvHoPYTOYQ.cMAcjK8HjHcbxxuArAf5a1KfLnjm	6287738103535	t	custom	internal	t	\N
UP7iELzsfMGj	d.she0112@gmail.com	desy	trin	\N	2025-10-20 03:24:01.442804	2025-10-28 02:17:36.708	$2b$12$ZarQYJb2W/XLHtBbng3pqehAWbJpLG7u1f6ELAquomJTsXW9SF2ie	6285647722350	t	custom	internal	t	\N
YpiCGGP-HUEl	budi.setiawan@gmail.com	Budi	Setiawan	\N	2025-10-14 08:41:18.784512	2025-12-08 09:36:10.359	$2b$12$NzYCsjglWFXuXzWDyJDrluJuS.jaWLtTVk1Dp3oMfA/9DwxUd50zy	6288156732134	t	custom	internal	t	\N
TvCd1ViqqEfE	gsarwohadi@gmail.com	Guntur	Sarwohadi	\N	2025-09-03 13:53:56.130566	2025-12-08 09:36:46.864	$2b$12$aZdCz49.JqalPBTA.nH0ou0icjqDbUDDF/ZsdVjJgZRp/XE9WjpZW	628156852279	t	custom	internal	t	\N
LVoRx5kxy1hx	yenitriwahyuningsih@gmail.com	Yeni 	Triwahyuningsih	\N	2025-08-22 06:37:33.245522	2025-12-09 01:23:51.042	$2b$12$87AKDsr4TzHi5OgbNnP5G.5F.Xv5V.4QYXpDyTO14oDb/JFySuDwa	62811258283	t	custom	admin	t	2025-09-28 11:35:29.765
qm3s3VD7srK_	yr.ari.bsantoso@gmail.com	Ari	BSantoso	\N	2025-10-20 04:11:24.40519	2025-10-28 02:17:46.598	$2b$12$IKmxEd9snjGlUscHnaOxLOlXpw44683iNDe2Kd1J15mn5uZV0RjQW	6281390257810	t	custom	internal	t	\N
a8FqwmvzBh5e	tedsyboys75@gmail.com	Inara	Rahmania prambudi	\N	2025-10-20 07:31:41.252739	2025-10-28 02:18:02.021	$2b$12$t7nQ5lUo3UF230HOcFkXlOuktG7BkfrVoeHpQiPB7fsQfEiOBSqvW	628122414999	t	custom	internal	t	\N
wH-FvIdbKTcA	vivin.irmawati@gmail.com	Maheswara Danesh	Prasetyo	\N	2026-02-02 02:14:49.11307	2026-02-11 09:10:25.547	$2b$12$rV59W5nEEHcKHfrhJxFA2edRupcKMU9Gb4Rt8Yoe/75eLjtCyEl1W	6282136227072	t	custom	internal	t	\N
X56CUJqS8IV6	astrid.primidawati@gmail.com	Aiza	Adya Rahma	\N	2025-12-23 08:42:48.115266	2025-12-24 02:09:06.026	$2b$12$qq7.A0dJsxedUwVL7Ms.p.uGsDWMUCfsbKJrrKZ5X37l.Qi2cSkoK	6281392391001	t	custom	internal	t	2025-12-25 03:34:35.783
_TuW440hbVsB	pungkimawardani2@gmail.com	Alvaro	Riki Pradana	\N	2026-02-02 02:16:30.106033	2026-02-11 09:10:31.134	$2b$12$CqBAjIz41LR9YUXHhS7S6enCtYMZShl/Sl3mMxDbKznYaACzYXHoq	6285340043715	t	custom	internal	t	\N
ViKPi4lJkD_D	risnatimalinda@gmail.com	Jayden	Malinowski Combe	\N	2026-02-02 02:19:51.667351	2026-02-11 09:10:36.293	$2b$12$wYee2fhSVSxqS.HmFsPmTOAbct9qVEW9BAd.XaEZuPD311uG2xaRm	6281999375200	t	custom	internal	t	\N
vOveXPRRAfqN	yudistariwaluyo66467@gmail.com	Kidung	Kinara	\N	2025-10-20 03:15:57.143627	2025-10-28 02:17:32.446	$2b$12$hN9MR7w.NLwk1N/6SIbd0.nPOhnAAm4RnQtP80Xgqk.2PWLNUn8yu	6281392058993	t	custom	internal	t	\N
YVxpGTOumjU3	trimurdiati52@guru.smk.belajar.id	tri	murdiati	\N	2025-10-20 05:05:19.505091	2025-10-28 02:17:51.685	$2b$12$mf7FNyeVwO2WgMrwN1SGIuQF/lTN6JSmoHSXJ0.edkVBR7m/n42nO	628122770671	t	custom	internal	t	\N
4rt4mMlS-uCN	dewiayuratih01@gmail.com	Berlian	Azzahra	\N	2025-10-20 05:28:58.589832	2025-10-28 02:17:56.485	$2b$12$mgZoxjMwh/1.vV/StQpu.Ofz0iJCbDprWxzNaLLpGXhi3/SGNYAZG	6282138627631	t	custom	internal	t	\N
srdtaXzbNgVz	thomasc.kristianto@gmail.com	Thomas	Kristianto	\N	2025-10-24 14:32:33.190361	2025-10-28 02:18:09.627	$2b$12$YXn/sSr8GUhfS9x98gRT9e24eRLiyFgbqscluwH/qeNWga6GGQe8i	62817275005	t	custom	internal	t	\N
nyc8-QmerUlh	wahyunitasetyaningrum@gmail.com	Sijiandru	Maula Satria	\N	2026-01-30 01:19:31.780056	2026-01-30 06:03:55.988	$2b$12$08ZWITPBiHixmUOpCP/kcuGO0HuDmgfOfjb3Fh9GUKArc3KR26XfS	6281270415659	t	custom	internal	t	2026-01-31 01:23:00.248
P0ZIeq09aNG-	hartingsihlionel@gmail.com	Lionel	Mudamakin	\N	2026-01-29 03:54:17.349169	2026-01-29 04:06:07.603	$2b$12$jCxcp76QCakNsUBYSrXad.s86nE1VCfbqtsH/6cxOJ9ZqNy5SQgPy	6281222998789	t	custom	internal	t	2026-01-31 06:01:53.349
R3j0GkP-PU5B	ululalbab6939@gmail.com	Dzaka	Fathul Fikri	\N	2026-02-02 02:21:30.394239	2026-02-11 09:10:41.664	$2b$12$jNr3845CBnUz8bKVxiEHK.OjfhrW4HeGmhFWFmHHEISU.gfHRaF1q	6281326098682	t	custom	internal	t	\N
tlgQqMnhM84a	miernafatima.drg@gmail.com	Mohaiya Artemisia	Nasywa	\N	2025-10-29 00:17:10.738982	2025-12-08 09:33:19.066	$2b$12$zpjynDph1OEXve2sJ.BTm.NBLi98WWAbhBXqnPeGdpXsBFzgnPHCS	628562909281	t	custom	internal	t	\N
L1lAu8xHPJE8	saritirtasaptaningsih@gmail.com	Ira	Tirta	\N	2025-11-10 04:40:11.988175	2025-12-08 09:33:49.25	$2b$12$l68p2mX0Vxb4awC/y31vb.VIaLzdZXPqXa3/JanLMOR/rC7AhmUSW	6281119119921	t	custom	internal	t	\N
IxNqR-cE2k9B	abi.yemima@gmail.com	Abigail	Yemima	\N	2025-10-29 07:47:30.634522	2025-12-08 09:34:23.54	$2b$12$Oe/LGtJqyaBWbtn2sE46Y.8/YyDWpDYFWnpquiDucNrlv0WFMA3nu	6282320369088	t	custom	internal	t	\N
iHpWhb3fm3lM	afrida.hirmawesi@gmail.com	Cahaya	Pelangi	\N	2026-01-07 09:01:16.558475	2026-01-13 03:00:00.103	$2b$12$fp8XoFKOyUr/v1RoO2IXZe.06u.mVFSpIVQI2eBPTY2MvQGC.PwcS	6289672740306	t	custom	internal	t	\N
fuXBqzQ0mOV4	sunandarharry@gmail.com	Sunandar 	Harry	\N	2026-01-08 03:37:36.053328	2026-01-13 03:00:18.656	$2b$12$RZSNjZbGSsjse63KrKcXPee2u2.5JbtQkC0tpWbSkQWsTtYgeuTwG	628112507623	t	custom	internal	t	\N
BjD746rJqX8B	cnovita156@gmail.com	Amsyar 	Raqilla Nusa	\N	2025-12-23 08:43:43.421062	2025-12-24 02:09:20.416	$2b$12$bAAOGbXB6E1IpTQneB4vaeAULLzbchAg.82A4nl1mM0yfEMCZbakO	6285930212826	t	custom	internal	t	2025-12-24 04:57:17.945
_a6MrAVDm9Mg	rofifitria44675@gmail.com	Ammar	Wiryawan	\N	2026-02-02 02:23:38.785351	2026-02-11 09:10:46.775	$2b$12$I4AtBQdSoV3.D5JvnPB8vucAFWIq76yVSR3mSfkY3SymnV6xMIkmm	6289502377270	t	custom	internal	t	\N
ESukSt922IEs	aries_yoesoef@yahoo.com	Arshaka	Virendra	\N	2026-02-02 02:27:33.131585	2026-02-11 09:10:51.377	$2b$12$LkMF90oUrQNVDe4a/6WJqu50zDYzbp/WrxOyDlV6DY8Yc0MnGgD0q	6281807728331	t	custom	internal	t	\N
hDtC9a4Hg-P1	teddyboys75@gmail.com	Inara	Rahmania Pambudi	\N	2026-02-02 02:29:04.213398	2026-02-11 09:10:55.705	$2b$12$8XI4VWLQX/yU/37Mttmfael39hVr2zYYMLp89sxZx2LvjQDDeAYXq	628122414999	t	custom	internal	t	\N
s6tQ4RrnS1HM	zelinauliarohman@gmail.com	ZELYN AULIA	ROHMAN	\N	2026-03-03 08:34:44.916515	2026-03-17 06:33:12.62	$2b$12$qREzFFKXVNM6y55OWcQPTeeArLwH23krqIplCBfXbf60o/CN.5ShC	6281228484364	t	custom	internal	t	\N
RcZpOP7Hxv0o	endangsukartiramadhanny@gmail.com	Sabrang	Mowodipo Nugroho	\N	2026-02-02 02:13:16.524535	2026-02-11 09:10:19.439	$2b$12$NCTDtpuatzSnYhXgwRhVy.YA68TgALGl3XbvUzppw8LK1v3u4WEK2	6281227502864	t	custom	internal	t	\N
tQZlHYJXPS6F	azkaalfa1922@gmail.com	Mohammad Azka	Alfa Raharja	\N	2026-02-02 02:30:27.907383	2026-02-11 09:10:59.928	$2b$12$waJF3IQORHM87UJAhsje9e4lc2OjiuiC6lBxew/dJwY1OJZgX2Rvi	6285727262535	t	custom	internal	t	\N
C6Z9rIPn0jC9	octariogilang@gmail.com	Kanezka Sky	Hiroyuki	\N	2026-02-02 02:32:00.497426	2026-02-11 09:11:04.853	$2b$12$STPKrDemcIobW54YmtG8lubbrjeUgZmtuZ9JYsuDrag/Zv7o41UrK	6281328585671	t	custom	internal	t	\N
pjTOkUUCpXtW	iptakhur@gmail.com	Arkhan	Yusuf Rafasya	\N	2026-02-02 02:33:43.092817	2026-02-11 09:11:09.444	$2b$12$I7ulB3/gJ.jrNmz6q0bqsu5R386j4kf7DcsRxC.6IqBEzhpo8ngDC	628128141946	t	custom	internal	t	\N
ILNui9BbubDL	marchoferdiansalim@gmail.com	Aruna	Isvara Aiko	\N	2026-03-17 03:26:20.458159	2026-03-17 06:33:21.651	$2b$12$x624dm7phCwwTs.fYzMENO6zk2Xvjs4HSzIxJwbZp4YvOnDFWJtOi	6285274082829	t	custom	internal	t	2026-03-27 03:23:49.804
kZzxpJ0CVEgI	fachrahdiba@gmail.com	Arkana	Ramdhan Narendra	\N	2026-02-11 08:54:25.705904	2026-02-11 09:10:06.341	$2b$12$vSbOvQ03bRnXz.akMM0h9ecvEoEWK71AwCtrWwBKPsLuuigIX/owO	6281903997751	t	custom	internal	t	2026-02-12 01:07:55.738
38uyQgQLGMt3	fita.meriana@gmail.com	Nathissa	Marinka Hutomo	\N	2026-03-27 03:28:04.008264	2026-03-27 05:25:38.583	$2b$12$agkUiBsF1DYz1ysLkZL4su9vb4xW7vWbzS51GFPIQWQr2gD94fp9K	6281221812441	t	custom	internal	t	2026-03-30 02:43:13.384
OXrbvlmzEmhd	apramusita@gmail.com	Anggita	Pramusita	\N	2026-03-28 01:05:16.837421	2026-04-18 05:06:41.514	$2b$12$ILpZoSLVDwUsQlaTVji3WOJZTyk7b18PdwjbB6m9gD.AtQtWrxRpm	6285725230613	t	custom	internal	t	\N
admin	admin@rumahpsikologi.com	Admin	System	\N	2025-07-21 14:53:38.914916	2025-07-21 14:53:38.914916	$2b$10$gbm2sr6rKtC4FeEVs5uheezDtx/vLg7yjE5/2VmKilM59G3lAcLwy	+628123456789	t	manual	admin	t	2026-02-28 04:58:38.286
d_g-3GaM0rMl	fathimahazzahra.work@gmail.com	Fathimah	Rakhman	\N	2026-03-27 01:00:09.977979	2026-03-27 05:25:20.054	$2b$12$BHf/U3Lx0Z3iRPf3zqqdZOBl.RqwfZP/UCjvmXM0TxJwqgOWGhkc.	628998669866	t	custom	internal	t	\N
aCBnJE-nuzqq	firmanyudhiarto21@gmail.com	Aleena	Citra Kirania	\N	2026-02-18 01:41:21.115333	2026-02-18 04:01:32.284	$2b$12$Qjcoyiwu18v1Hy6VKZWxrObtrFDJ2GTrxmq81QQGRemgeC1mkSwhG	6281329988098	t	custom	internal	t	2026-03-28 01:32:42.453
yBqNeMDOpVxn	goldennovember95@gmail.com	Anggita	Pramusita	\N	2026-03-27 02:09:31.795676	2026-03-27 05:25:28.86	$2b$12$YcGMdkqDGIAvmlTRtASpkuZUFahrjs/7So/dAEf7B4DvB3LK9X20e	6285725230613	t	custom	internal	t	2026-03-27 09:37:44.812
\.


--
-- Name: assessments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.assessments_id_seq', 9, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.order_items_id_seq', 334, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.orders_id_seq', 324, true);


--
-- Name: otp_verifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.otp_verifications_id_seq', 1, true);


--
-- Name: user_assessments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.user_assessments_id_seq', 155, true);


--
-- Name: assessments assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: user_assessments user_assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_assessments
    ADD CONSTRAINT user_assessments_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: order_items order_items_assessment_id_assessments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_assessment_id_assessments_id_fk FOREIGN KEY (assessment_id) REFERENCES public.assessments(id);


--
-- Name: order_items order_items_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: orders orders_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_assessments user_assessments_assessment_id_assessments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_assessments
    ADD CONSTRAINT user_assessments_assessment_id_assessments_id_fk FOREIGN KEY (assessment_id) REFERENCES public.assessments(id);


--
-- Name: user_assessments user_assessments_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_assessments
    ADD CONSTRAINT user_assessments_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: user_assessments user_assessments_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_assessments
    ADD CONSTRAINT user_assessments_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict 5DyCCSqop67dIYJ9dhA1CrIx9pVxJgdxfcUXPXARRJIRga8m0XDTSsLBdQyOQ0z

