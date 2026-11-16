import os

header_and_part1 = """No,Jenis Perusahaan,Nama Perusahaan,Identitas,Lingkup Aktivitas,Rerata Frekuensi,Daftar Komoditas,"KH, KI, KT",Tempat Karantina,Status Kepemilikan,Email,Tanggal Registrasi,Status Blokir
1,,Edi kosasi,KTP,Export,1,Pinang,,Luar,,edykosasi1295@gmail.com,7/6/2026 12:08,Aktif
2,,Ilham Bagus Satria,KTP,Domestik Masuk,1,Kucing,,Luar,,ilhamsatriain@gmail.com,7/5/2026 21:38,Aktif
3,,Elza Yunita Rezkiani,KTP,Domestik Keluar,1,Kucing,,Luar,,rezkiani.elza@gmail.com,7/4/2026 21:48,Aktif
4,induk,PT. ZENOVA COCO GLOBAL,NPWP,Import; Domestik Masuk; Export; Domestik Keluar,16,COCOPEAT,,Luar,Sewa,ardy.tj11@gmail.com,7/2/2026 19:34,Aktif
5,induk,PT. Enjoy Life Indonesia,NPWP,Import,3,biji jagung,,Luar,Sewa,ptenjoylifeindonesia@gmail.com,7/2/2026 15:57,Aktif
6,induk,PT. MITRA HIJAU LESTARI,NPWP,Import; Export,12,-,,Luar,Sewa,admin_exim@mitrahijaulestari.com,7/2/2026 15:56,Aktif
7,,SITI MAESAROH,KTP,Domestik Keluar,0,SUGAR GLIDER,,Luar,,mayqoiss@gmail.com,7/2/2026 10:27,Aktif
8,induk,PT. CENTRAL CHARCOAL BABELINDO,NPWP,Export; Domestik Keluar,7,DAUN KETAPANG KERING,,Luar,Sewa,centralcharcoalbabelindo@gmail.com,7/1/2026 22:24,Aktif
9,induk,PT. BAHARI GEMBIRA RIA,NPWP,Import,12,KELAPA SAWIT,,Luar,Milik Sendiri,pt.bgr@sdguthrie.com,7/1/2026 16:02,Aktif
10,,Sudarto,KTP,Domestik Keluar,1,Sengon,,Luar,,INTRACAHUTANI@GMAIL.COM,7/1/2026 15:16,Aktif
11,,T. Rajashah Ratnawangsa,KTP,Domestik Masuk; Domestik Keluar,1,Gecko/Reptil,,Luar,,stillsick8@gmail.com,7/1/2026 13:07,Aktif
12,induk,PT. MAKEEN GLOBAL VENTURES,NPWP,Import; Export,50,-,,Luar,Sewa,makeenglobalventures@gmail.com,7/1/2026 9:40,Aktif
13,induk,PT. Berkah Freshindo Tuna,NPWP,Domestik Masuk; Export; Domestik Keluar,96,tuna beku,,Luar,Milik Sendiri,berkahfreshindotuna@gmail.com,6/30/2026 14:44,Aktif
14,induk,CV. AGRO BINA USAHA,NPWP,Import; Export,30,30,,Luar,Milik Sendiri,agrobinausaha@gmail.com,6/30/2026 14:38,Aktif
15,induk,PT. SUMBER SAMUDERA INDONESIA,NPWP,Export,48,-,,Luar,Milik Sendiri,sumbersamuderaindonesia6@gmail.com,6/30/2026 14:24,Aktif
16,,NOVI ARIYANTI,KTP,Export,-1,KULIT BUAH,,Luar,,novi94ariyanti@gmail.com,6/30/2026 13:36,Aktif
17,induk,PT. ALVIN MAJU BERSAMA,NPWP,Import; Export,5,BULU BEBEK,,Luar,Sewa,pt.alvinmajubersama@gmail.com,6/30/2026 12:05,Aktif
18,induk,PT. AGRO TANAH KITA,NPWP,Import,-100,-,,Luar,Milik Sendiri,agrotanahkita@gmail.com,6/30/2026 10:29,Aktif
19,,syarif hidayatullah,KTP,Export,10,-,,Luar,,syarifhidayatullah06484@gmail.com,6/30/2026 9:39,Aktif
20,induk,PT. SEJAHTERA TANAH KITA,NPWP,Import,5,-,,Luar,Milik Sendiri,sejahteratanahkita@gmail.com,6/29/2026 15:51,Aktif
21,induk,PT. PUTRA INDONESIA INTERNATIONAL,NPWP,Export; Domestik Keluar,7,KRATOM ( MITRAGYNA SPECIOSA ),,Luar,Sewa,wbobservation@gmail.com,6/29/2026 15:08,Aktif
22,induk,CV. KEBUN KREATIF BERSEMI,NPWP,Import,49,FRESH GARLIC (UMBI),,Luar,Sewa,kebunkreatifbersemi@gmail.com,6/29/2026 13:51,Aktif
23,induk,PT. AUNTEA JENNY TRADING INDONESIA,NPWP,Import; Export,24,FROZEN GRAPES & FROZEN STRAWBERRY,,Luar,Sewa,ptaunteajennytradingindonesia@gmail.com,6/28/2026 13:25,Aktif
24,induk,PT. MAHIKA GLOBAL NUSANTARA,NPWP,Export,20,"Buah Nanas, Palawija, Kopi, Cengkeh, Biji Pala, Kelapa, Kopra, dll.",,Luar,Sewa,mahikaglobalnusantara@gmail.com,6/28/2026 11:59,Aktif
25,,Abdul Ajis,KTP,Import; Export,20,"ANGGUR, JERUK, PIR, KURMA, SUNKIST, APEL, LECI,",,Luar,,abdoelajis92@gmail.com,6/27/2026 13:47,Aktif
26,induk,PT. Semangat Bersama Entrepreneurship,NPWP,Import; Domestik Masuk; Export; Domestik Keluar,2,Benih Padi M70D,,Luar,Sewa,sbe@mtanigroup.com,6/27/2026 11:05,Aktif
27,,Denisa Rusli,KTP,Import,1,Roasted Coffee Beans (untuk KONSUMSI PRIBADI),,Luar,,feliciadenisa2887@gmail.com,6/27/2026 7:14,Aktif
28,induk,PT. KAYU MAKMUR ABADI,NPWP,Import,20,PLYWOOD,,Luar,Sewa,kayumakmur.imp@gmail.com,6/26/2026 16:18,Aktif
29,,KRUTIKA SAINANI,NPWP,Import,5,"Kismis, Tepung Gandum, Chia Seed",,Luar,,krutikasainani@gmail.com,6/26/2026 15:10,Aktif
30,induk,PT. DreamWear,NPWP,Import; Export,1,Duck Down Dan Goose Down,,Luar,Milik Sendiri,maulana@dreamwear.biz,6/26/2026 15:02,Aktif
31,induk,PT. INOVASI BOGA PERKASA,NPWP,Import,30,Daging sapi dan Jerohan,,Luar,Milik Sendiri,hellen@sauindo.com,6/26/2026 14:57,Aktif
32,induk,PT. KA DUA EMPAT,NPWP,Import,2,Test Kehamilan Strip ; Merk OMO IZZI,,Luar,Milik Sendiri,kde.yogyakarta@k24.co.id,6/26/2026 14:51,Aktif
33,induk,PT. SANTOSA AGRINDO LESTARI,NPWP,Import; Domestik Masuk; Domestik Keluar,1400,SAPI,,Luar,Sewa,wisynu.wardhana@japfa.com,6/26/2026 14:26,Aktif
34,,Sumadi Kusuma,KTP,Import,5,-,,Luar,,jessica_ariady@yahoo.com,6/25/2026 16:45,Aktif
35,induk,PT. TRADA ALAM NUSANTARA,NPWP,Export,3,LEATHER CALIGRAPHY,,Luar,Milik Sendiri,tradaalamnusantara@gmail.com,6/25/2026 16:36,Aktif
36,induk,PT. MUARA LAUT SEJAHTERA,NPWP,Domestik Masuk; Export; Domestik Keluar,10000,"Crab, Lobster, Slipper Lobster, Shell, Snail, Freshwater Fish, Squillamantis, Swimming Crab, Moa, Freshwater Lobster; Demersal Fish, Pelagic Fish, Freshwater Fish, Shrimp; Kering: Fish, Cephalopods, Shark, Stingray, Sea Cucumber, Sea Worm, Fish Maw, Abalone, Shrimp, Fish Roe",,Luar,Sewa,muaralautsejahtera@gmail.com,6/25/2026 15:54,Aktif
37,induk,PT. MANYSTAR FOOD SUPPLY CHAIN,NPWP,Import,5,BLACK TEA,,Luar,Sewa,manystar.fsc@gmail.com,6/25/2026 15:29,Aktif
38,induk,PT. ERLANG JEURAM NIAGA,NPWP,Import; Domestik Masuk; Export; Domestik Keluar,10,Pakan Ternak,,Luar,Sewa,info@reigencargoindonesia.co.id,6/25/2026 14:55,Aktif
39,,Erlangga Wibisono Witoyo,KTP,Export,3,Green bean kopi,,Luar,,erly.witoyo@gmail.com,6/25/2026 14:21,Aktif
40,induk,PT. TRIBRATA SEMESTA ABADI,NPWP,Import,4,KULIT HEWAN,,Luar,Sewa,yanpramono1@gmail.com,6/25/2026 11:40,Aktif
41,induk,PT. SADONA CATUR PERKASA,NPWP,Import; Domestik Masuk; Export; Domestik Keluar,11,"Minuman Non Alkohol Bukan Susu. Rokok & Tembakau. Kopi, Teh dan Kakao. Bahan Makanan, Minuman Hasil Pertanian.",,Luar,Milik Sendiri,stanleytikando@gmail.com,6/25/2026 11:37,Aktif
42,cabang,PT. ERO CATRI ARUNIKA,NPWP,Export,12,-,,Luar,Sewa,calamangsiang@gmail.com,6/25/2026 11:15,Aktif
43,induk,PT. Hokkan Indonesia,NPWP,Import; Export,4,Daun Teh Hijau,,Luar,Milik Sendiri,malvino@hokkan.co.id,6/25/2026 10:08,Aktif
44,induk,CV. Enzyme Prakasa Berjaya,NPWP,Import,-1,Papain bubuk (ekstrak/ enzim dari buah pepaya kering),,Luar,Sewa,enzymeprakasaberjaya@gmail.com,6/25/2026 4:22,Aktif
45,induk,PT. MITRA ANDALAN TANI,NPWP,Import,50,BIJI - KONSUMSI,,Luar,Sewa,ptmitraandalantani@yahoo.com,6/24/2026 16:19,Aktif
46,,Dini Rahayu Putri,NPWP,Domestik Keluar,1,Cocopeat,,Luar,,dinirahayup@gmail.com,6/24/2026 13:44,Aktif
47,,Catharina Susanto,KTP,Domestik Masuk,1,Anjing,,Luar,,1305cath@gmail.com,6/24/2026 9:06,Aktif
48,,Kristin Benigna,KTP,Export,12,Dried Vanilla Beans,,Luar,,kristinbenigna@gmail.com,6/23/2026 21:53,Aktif
49,induk,PT. PARAMA INGREDIA CITRA RASA,NPWP,Import,6,"Gelatin 260 bloom, 40 mesh",,Luar,Sewa,reinald@paramaingredia.com,6/23/2026 14:32,Aktif
50,induk,PT. BERKAH NUANSA DAMAI,NPWP,Import; Export,15,PAKAN HEWAN KESAYANGAN,,Luar,Sewa,andrifitriyansyah92@gmail.com,6/23/2026 14:17,Aktif
"""

with open('src/data/quarantine_raw.csv', 'w', encoding='utf-8') as f:
    f.write(header_and_part1.strip() + '\n')

print("Part 1 written.")
