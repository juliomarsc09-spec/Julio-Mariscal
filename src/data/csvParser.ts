import { MediaPembawaRecord, QuarantineCategory, RiskLevel } from '../types';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseQuarantineCSV(csvText: string): MediaPembawaRecord[] {
  const lines = csvText.split(/\r?\n/);
  const records: MediaPembawaRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const row = parseCSVLine(line);
    if (row.length < 3) continue;

    const noVal = parseInt(row[0]) || i;
    const jenisPerusahaan = row[1] || '';
    const pemohon = row[2] || 'Perusahaan/Pemohon';
    const identitas = row[3] || 'NPWP';
    const lingkupAktivitas = row[4] || 'Import';
    const frekuensi = parseFloat(row[5]) || 1;
    const komoditas = row[6] && row[6] !== '-' ? row[6] : 'Media Pembawa Karantina';
    const khKiKt = row[7] || '';
    const tempatKarantina = row[8] || 'BBKP Jakarta';
    const statusKepemilikan = row[9] || 'Sewa';
    const email = row[10] || '';
    const tanggalRegistrasi = row[11] || '';
    const statusBlokir = row[12] || 'Aktif';

    // Determine category
    let kategori: QuarantineCategory = 'TUMBUHAN';
    const code = khKiKt.toUpperCase();
    if (code.includes('KH')) {
      kategori = 'HEWAN';
    } else if (code.includes('KI')) {
      kategori = 'IKAN';
    } else if (code.includes('KT')) {
      kategori = 'TUMBUHAN';
    } else {
      const komLower = komoditas.toLowerCase();
      const ikanKeywords = [
        'ikan', 'tuna', 'salmon', 'cumi', 'udang', 'lobster', 'kepiting',
        'mackerel', 'makarel', 'surimi', 'patin', 'rajungan', 'seaweed',
        'rumput laut', 'octopus', 'gurita', 'belut', 'sidat', 'arwana',
        'koi', 'cupang', 'seafood', 'mussel', 'oyster', 'scallop', 'sarden',
        'abalone', 'teripang', 'fish', 'clam', 'eel', 'layang', 'tongkol',
        'cakalang', 'kembung', 'bawal', 'kakap', 'kerapu', 'nila', 'gurame',
        'lele', 'teri', 'sotong', 'dori'
      ];
      const hewanKeywords = [
        'daging', 'sapi', 'kucing', 'anjing', 'ayam', 'bebek', 'kuda', 'pakan',
        'bulu', 'gelatin', 'susu', 'keju', 'mentega', 'suplemen', 'dok', 'babi',
        'monyet', 'reptil', 'gecko', 'ular', 'sugar glider', 'tokek', 'hewan',
        'bovine', 'lamb', 'pork', 'whey', 'egg', 'mencit', 'poultry', 'kambing',
        'kerbau', 'domba', 'unggas', 'bird', 'anabul', 'hamster', 'kelinci',
        'maggot', 'sosis', 'nugget', 'bakso', 'leather', 'kulit'
      ];

      if (ikanKeywords.some((k) => komLower.includes(k))) {
        kategori = 'IKAN';
      } else if (hewanKeywords.some((k) => komLower.includes(k))) {
        kategori = 'HEWAN';
      }
    }

    // Determine risk level
    let tingkatRisiko: RiskLevel = 'RENDAH';
    if (statusBlokir.toLowerCase().includes('terblokir')) {
      tingkatRisiko = 'SANGAT TINGGI';
    } else {
      const komLower = komoditas.toLowerCase();
      if (
        ['daging', 'jerohan', 'sapi', 'babi', 'hidup', 'benih', 'bibit', 'vaksin', 'bahan biologis'].some(
          (k) => komLower.includes(k)
        )
      ) {
        tingkatRisiko = 'TINGGI';
      } else if (
        ['susu', 'keju', 'mentega', 'whey', 'pakan', 'tepung', 'tuna', 'salmon', 'cumi', 'makarel', 'gelatin', 'bulu', 'ikan'].some(
          (k) => komLower.includes(k)
        )
      ) {
        tingkatRisiko = 'SEDANG';
      }
    }

    // Asal calculation
    const isImport = lingkupAktivitas.toLowerCase().includes('import');
    const asalRaw = isImport ? 'INTERNASIONAL' : 'INDONESIA';
    const tempatRaw = tempatKarantina === 'Luar' ? 'Instalasi Karantina Luar (IKL)' : tempatKarantina;

    // Extract HS Code
    const hsMatch = komoditas.match(/\b\d{4,8}\b/);
    const hsCode = hsMatch ? hsMatch[0] : kategori === 'HEWAN' ? '0201.30.00' : kategori === 'IKAN' ? '0303.89.90' : '0901.11.00';

    records.push({
      id: `rec-csv-${noVal}`,
      no: noVal,
      kategori,
      pemohon,
      komoditas,
      tempatPeriksa: [tempatRaw],
      tempatPeriksaRaw: tempatRaw,
      asal: [asalRaw],
      asalRaw,
      kodeHs: [hsCode],
      kodeHsRaw: hsCode,
      tingkatRisiko,
      jenisPerusahaan,
      identitas,
      lingkupAktivitas,
      frekuensi,
      statusKepemilikan,
      email,
      tanggalRegistrasi,
      statusBlokir,
    });
  }

  return records;
}
