part7 = """341,induk,CV. AGRO BERSAMA JAYA,NPWP,Import; Domestik Masuk; Export; Domestik Keluar,55,Bawang Merah dan Bawang Putih,,Luar,Milik Sendiri,agrokita@gmail.com,4/16/2026 15:20,Aktif
342,induk,PT. LESTARI NUSANTARA SEAFOOD,NPWP,Export,40,Kepiting Bakau Hidup,,Luar,Milik Sendiri,lestarinusantara.seafood@gmail.com,4/16/2026 14:10,Aktif
343,,Agus Setiawan,KTP,Export,2,Biji Kakao Kering,,Luar,,agussetiawan.kakao@gmail.com,4/16/2026 11:25,Aktif
344,induk,PT. NUSANTARA TIMBER EXPORT,NPWP,Export,25,Kayu Meranti Olahan,,Luar,Sewa,nusantaratimberexport@gmail.com,4/16/2026 9:05,Aktif
345,induk,PT. BUMI HIJAU SEJAHTERA,NPWP,Import,10,Pupuk NPK Organik,,Luar,Milik Sendiri,bumihijausejahtera@gmail.com,4/15/2026 16:40,Aktif
346,,Tri Widodo,KTP,Domestik Keluar,1,Kucing Persi,,Luar,,triwidodo.cat@gmail.com,4/15/2026 13:50,Aktif
347,induk,PT. GLOBAL FOOD SUPPLIES,NPWP,Import,70,Daging Sapi Beku,,Luar,Sewa,globalfoodsupplies@gmail.com,4/15/2026 10:30,Aktif
348,induk,PT. TROPICAL SPICE INDONESIA,NPWP,Export,30,Lada Hitam dan Lada Putih,,Luar,Milik Sendiri,tropicalspiceindo@gmail.com,4/15/2026 8:45,Aktif
349,induk,CV. MITRA SEAFOOD MANDIRI,NPWP,Export,50,Ikan Cakalang Beku,,Luar,Sewa,mitraseafoodmandiri@gmail.com,4/14/2026 17:15,Aktif
350,induk,PT. AGRO UTAMA LESTARI,NPWP,Import,20,Biji Jagung Pakan,,Luar,Milik Sendiri,agroutamalestari@gmail.com,4/14/2026 14:00,Aktif
351,,Eko Prasetyo,KTP,Export,3,Kopi Arabika Gayo,,Luar,,ekoprasetyo.gayo@gmail.com,4/14/2026 11:20,Aktif
352,induk,PT. MULTI SEAFOOD NUSANTARA,NPWP,Import; Export,110,Cumi-Cumi Beku,,Luar,Sewa,multiseafoodnusantara@gmail.com,4/14/2026 9:15,Aktif
353,induk,PT. GRAHA KAYU INDONESIA,NPWP,Export,15,Kayu Jati Olahan,,Luar,Milik Sendiri,grahakayuindonesia@gmail.com,4/13/2026 16:10,Aktif
354,,Siti Rahmawati,KTP,Domestik Masuk,1,Anjing Poodle,,Luar,,sitirahmawati.poodle@gmail.com,4/13/2026 13:40,Aktif
355,induk,PT. HERBAL NATURE SEJAHTERA,NPWP,Export,22,Ekstrak Temulawak,,Luar,Sewa,herbalnaturesejahtera@gmail.com,4/13/2026 10:50,Aktif
356,induk,PT. PANGAN SEGAR MANDIRI,NPWP,Import,80,Buah Jeruk Mandarin,,Luar,Milik Sendiri,pangansegarmandiri@gmail.com,4/13/2026 8:30,Aktif
357,induk,CV. AGRO TANI SUKSES,NPWP,Export,12,Biji Vanili Kering,,Luar,Sewa,agrotanisukses@gmail.com,4/12/2026 15:45,Aktif
358,,Hendra Wijaya,KTP,Export,5,Sarang Burung Walet,,Luar,,hendrawijaya.walet@gmail.com,4/12/2026 12:15,Aktif
359,induk,PT. INDO SAMUDERA LOGISTIK,NPWP,Import; Export,250,-,,Luar,Milik Sendiri,indosamuderalogistik@gmail.com,4/12/2026 9:50,Aktif
360,induk,PT. GREEN AGRO EXPORT,NPWP,Export,35,Coco Peat Block,,Luar,Sewa,greenagroexport@gmail.com,4/11/2026 16:30,Aktif
"""

with open('src/data/quarantine_raw.csv', 'a', encoding='utf-8') as f:
    f.write(part7.strip() + '\n')

print("Part 7 appended.")
