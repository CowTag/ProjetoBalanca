import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { ah } from '../lib/http';
import { fid, requireRole } from '../middleware/auth';

export const farmRouter = Router();

// ---------- Fazenda do usuário ----------
farmRouter.get(
  '/farm',
  ah(async (req, res) => {
    res.json(await prisma.farm.findUniqueOrThrow({ where: { id: fid(req) } }));
  }),
);

farmRouter.put(
  '/farm',
  requireRole('admin'),
  ah(async (req, res) => {
    const data = z
      .object({
        nome: z.string().min(2),
        localizacao: z.string().nullish(),
        area_hectares: z.coerce.number().nonnegative().nullish(),
      })
      .parse(req.body);
    res.json(await prisma.farm.update({ where: { id: fid(req) }, data }));
  }),
);

// ---------- Usuários / perfis ----------
const userSelect = { id: true, nome: true, email: true, funcao: true, criado_em: true } as const;

farmRouter.get(
  '/users',
  ah(async (req, res) => {
    res.json(await prisma.user.findMany({ where: { fazenda_id: fid(req) }, select: userSelect, orderBy: { nome: 'asc' } }));
  }),
);

farmRouter.post(
  '/users',
  requireRole('admin'),
  ah(async (req, res) => {
    const d = z
      .object({
        nome: z.string().min(2),
        email: z.string().email().transform((e) => e.toLowerCase()),
        senha: z.string().min(6),
        funcao: z.enum(['admin', 'operador']).default('operador'),
      })
      .parse(req.body);
    const user = await prisma.user.create({
      data: { nome: d.nome, email: d.email, funcao: d.funcao, senha_hash: await bcrypt.hash(d.senha, 10), fazenda_id: fid(req) },
      select: userSelect,
    });
    res.status(201).json(user);
  }),
);

farmRouter.delete(
  '/users/:id',
  requireRole('admin'),
  ah(async (req, res) => {
    await prisma.user.deleteMany({ where: { id: req.params.id, fazenda_id: fid(req), NOT: { id: req.user!.id } } });
    res.status(204).end();
  }),
);
