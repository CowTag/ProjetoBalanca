/**
 * Dados de demonstração:
 *   admin@cowtag.local / cowtag123   (admin)
 *   operador@cowtag.local / cowtag123 (operador)
 *   Dispositivo BALANCA_ESP32_01 com chave "dev-key-balanca-01"
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const prisma = new PrismaClient();
const hashKey = (k: string) => crypto.createHash('sha256').update(k).digest('hex');

// PRNG determinístico p/ dados reproduzíveis
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const between = (a: number, b: number) => a + rand() * (b - a);

async function main() {
  await prisma.sensorLog.deleteMany();
  await prisma.weightLog.deleteMany();
  await prisma.animal.deleteMany();
  await prisma.device.deleteMany();
  await prisma.user.deleteMany();
  await prisma.farm.deleteMany();

  const farm = await prisma.farm.create({
    data: { nome: 'Fazenda Boa Vista', localizacao: 'Uberaba - MG', area_hectares: 850 },
  });

  const senha_hash = await bcrypt.hash('cowtag123', 10);
  await prisma.user.createMany({
    data: [
      { nome: 'Administrador', email: 'admin@cowtag.local', senha_hash, funcao: 'admin', fazenda_id: farm.id },
      { nome: 'Operador Tronco', email: 'operador@cowtag.local', senha_hash, funcao: 'operador', fazenda_id: farm.id },
    ],
  });

  const balanca = await prisma.device.create({
    data: {
      identificador_esp32: 'BALANCA_ESP32_01',
      nome: 'Balança Tronco 01',
      api_key_hash: hashKey('dev-key-balanca-01'),
      fazenda_id: farm.id,
    },
  });
  await prisma.device.create({
    data: {
      identificador_esp32: 'BALANCA_ESP32_02',
      nome: 'Balança Curral 02',
      api_key_hash: hashKey('dev-key-balanca-02'),
      fazenda_id: farm.id,
    },
  });

  const racas = ['Nelore', 'Angus', 'Brahman', 'Senepol', 'Girolando'];
  const tags = ['43:A2:89:C1', 'A1:B2:C3:D4', '7F:11:0A:9E', '12:34:56:78', 'DE:AD:BE:EF', '9A:4C:2E:10', '55:66:77:88', 'C0:FF:EE:01', 'B4:12:6D:3A', '0E:9F:21:C7'];

  const hoje = Date.now();
  for (let i = 0; i < tags.length; i++) {
    const animal = await prisma.animal.create({
      data: {
        tag_rfid: tags[i],
        brinco_visual: `BR-${String(101 + i).padStart(4, '0')}`,
        raca: racas[i % racas.length],
        sexo: i % 3 === 0 ? 'F' : 'M',
        data_nascimento: new Date(hoje - between(400, 800) * 86_400_000),
        status: i === 9 ? 'vendido' : 'ativo',
        fazenda_id: farm.id,
      },
    });

    // pesagens a cada ~15 dias nos últimos 120 dias
    let peso = between(220, 320);
    const gmd = between(0.45, 1.15);
    for (let d = 120; d >= 0; d -= Math.round(between(12, 18))) {
      await prisma.weightLog.create({
        data: {
          animal_id: animal.id,
          dispositivo_id: balanca.id,
          peso_kg: Math.round(peso * 1000) / 1000,
          timestamp: new Date(hoje - d * 86_400_000 - between(0, 6) * 3_600_000),
        },
      });
      peso += gmd * 15 + between(-4, 4);
    }
  }

  // telemetria das últimas 24h (a cada 30 min)
  const tel = [];
  for (let m = 24 * 60; m >= 0; m -= 30) {
    const ts = new Date(hoje - m * 60_000);
    tel.push(
      { dispositivo_id: balanca.id, tipo_sensor: 'rssi_wifi', valor: Math.round(between(-75, -55)), timestamp: ts },
      { dispositivo_id: balanca.id, tipo_sensor: 'temperatura_chip', valor: Math.round(between(38, 52) * 10) / 10, timestamp: ts },
      { dispositivo_id: balanca.id, tipo_sensor: 'bateria_v', valor: Math.round((3.8 + (m / 1440) * 0.3 - between(0, 0.03)) * 100) / 100, timestamp: ts },
    );
  }
  await prisma.sensorLog.createMany({ data: tel });

  console.log('Seed concluído. Login: admin@cowtag.local / cowtag123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
