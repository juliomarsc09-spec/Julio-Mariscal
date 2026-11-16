import fs from 'fs';
import path from 'path';

// Node script to convert prompt CSV data to JSON
const rawCsv = `No,Jenis Perusahaan,Nama Perusahaan,Identitas,Lingkup Aktivitas,Rerata Frekuensi,Daftar Komoditas,"KH, KI, KT",Tempat Karantina,Status Kepemilikan,Email,Tanggal Registrasi,Status Blokir
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
`;

console.log('Script template ready.');
