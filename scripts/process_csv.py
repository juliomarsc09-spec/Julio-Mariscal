import csv
import json
import re

def determine_category(kh_ki_kt, komoditas):
    code = (kh_ki_kt or '').strip().upper()
    if 'KH' in code:
        return 'HEWAN'
    if 'KI' in code:
        return 'IKAN'
    if 'KT' in code:
        return 'TUMBUHAN'
    
    kom = komoditas.lower()
    # Check Ikan
    ikan_kw = [
        'ikan', 'tuna', 'salmon', 'cumi', 'udang', 'lobster', 'kepiting', 
        'mackerel', 'makarel', 'surimi', 'patin', 'rajungan', 'seaweed', 
        'rumput laut', 'octopus', 'gurita', 'belut', 'sidat', 'arwana', 
        'koi', 'cupang', 'seafood', 'mussel', 'oyster', 'scallop', 'betutu', 
        'sarden', 'abalone', 'caviar', 'teripang', 'fish', 'clam', 'eel', 
        'manta', 'layang', 'tongkol', 'cakalang', 'kembung', 'bawal', 'kakap', 
        'kerapu', 'nila', 'gurame', 'lele', 'teri', 'sotot', 'sotong'
    ]
    if any(k in kom for k in ikan_kw):
        return 'IKAN'
        
    # Check Hewan
    hewan_kw = [
        'daging', 'sapi', 'kucing', 'anjing', 'ayam', 'bebek', 'kuda', 'pakan', 
        'bulu', 'gelatin', 'susu', 'keju', 'mentega', 'suplemen', 'dok', 'babi', 
        'monyet', 'reptil', 'gecko', 'ular', 'sugar glider', 'tokek', 'hewan', 
        'bovine', 'lamb', 'pork', 'whey', 'egg', 'mencit', 'poultry', 'kambing', 
        'kerbau', 'domba', 'unggas', 'bird', 'anabul', 'hamster', 'kelinci', 
        'maggot', 'sosis', 'nugget', 'bakso', 'dori', 'leather', 'kulit'
    ]
    if any(k in kom for k in hewan_kw):
        return 'HEWAN'
        
    return 'TUMBUHAN'

def calculate_risk(kategori, komoditas, asal_raw, status_blokir):
    if status_blokir and 'terblokir' in status_blokir.lower():
        return 'SANGAT TINGGI'
        
    kom = komoditas.lower()
    if any(k in kom for k in ['daging', 'jerohan', 'sapi', 'babi', 'hidup', 'benih', 'bibit', 'vaksin', 'bahan biologis']):
        return 'TINGGI'
    elif any(k in kom for k in ['susu', 'keju', 'mentega', 'whey', 'pakan', 'tepung', 'tuna', 'salmon', 'cumi', 'makarel', 'gelatin', 'bulu', 'ikan']):
        return 'SEDANG'
    else:
        return 'RENDAH'

def parse_csv(file_path):
    records = []
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.reader(f)
        header = next(reader, None)
        
        for idx, row in enumerate(reader, 1):
            if not row or len(row) < 3:
                continue
            
            no_val = row[0].strip() if len(row) > 0 else str(idx)
            jenis_perusahaan = row[1].strip() if len(row) > 1 else ''
            pemohon = row[2].strip() if len(row) > 2 else ''
            identitas = row[3].strip() if len(row) > 3 else ''
            lingkup_aktivitas = row[4].strip() if len(row) > 4 else ''
            
            freq_str = row[5].strip() if len(row) > 5 else ''
            try:
                freq = float(freq_str)
            except ValueError:
                freq = 1.0
                
            komoditas = row[6].strip() if len(row) > 6 else ''
            kh_ki_kt = row[7].strip() if len(row) > 7 else ''
            tempat_karantina = row[8].strip() if len(row) > 8 else ''
            status_kepemilikan = row[9].strip() if len(row) > 9 else ''
            email = row[10].strip() if len(row) > 10 else ''
            tanggal_registrasi = row[11].strip() if len(row) > 11 else ''
            status_blokir = row[12].strip() if len(row) > 12 else 'Aktif'
            
            if not pemohon and not komoditas:
                continue
                
            cat = determine_category(kh_ki_kt, komoditas)
            
            # Asal country inference from lingkup aktivitas
            if 'import' in lingkup_aktivitas.lower():
                asal_raw = 'INTERNASIONAL'
                asal_arr = ['INTERNASIONAL']
            else:
                asal_raw = 'INDONESIA'
                asal_arr = ['INDONESIA']
                
            # HS Code extract if present or dummy code based on category
            hs_match = re.search(r'\b\d{4,8}\b', komoditas)
            if hs_match:
                hs_raw = hs_match.group(0)
            else:
                if cat == 'HEWAN': hs_raw = '0201.30.00'
                elif cat == 'IKAN': hs_raw = '0303.89.90'
                else: hs_raw = '0901.11.00'
                
            tempat_raw = tempat_karantina if tempat_karantina else 'BBKP Jakarta'
            if tempat_raw == 'Luar':
                tempat_raw = 'Instalasi Karantina Luar (IKL)'
                
            risk = calculate_risk(cat, komoditas, asal_raw, status_blokir)
            
            try:
                no_num = int(no_val)
            except:
                no_num = idx
                
            rec = {
                'id': f'rec-csv-{no_num}',
                'no': no_num,
                'kategori': cat,
                'pemohon': pemohon or 'Perusahaan / Perorangan',
                'komoditas': komoditas if komoditas and komoditas != '-' else 'Media Pembawa Karantina',
                'tempatPeriksa': [tempat_raw],
                'tempatPeriksaRaw': tempat_raw,
                'asal': asal_arr,
                'asalRaw': asal_raw,
                'kodeHs': [hs_raw],
                'kodeHsRaw': hs_raw,
                'tingkatRisiko': risk,
                'jenisPerusahaan': jenis_perusahaan,
                'identitas': identitas,
                'lingkupAktivitas': lingkup_aktivitas,
                'frekuensi': freq,
                'statusKepemilikan': status_kepemilikan,
                'email': email,
                'tanggalRegistrasi': tanggal_registrasi,
                'statusBlokir': status_blokir
            }
            records.append(rec)
            
    print(f"Parsed {len(records)} records successfully.")
    with open('/src/data/quarantineDataset.json', 'w', encoding='utf-8') as out:
        json.dump(records, out, indent=2, ensure_ascii=False)

if __name__ == '__main__':
    parse_csv('/src/data/quarantine_raw.csv')
