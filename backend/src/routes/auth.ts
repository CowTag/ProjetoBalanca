import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError, ah } from '../lib/http';
import { requireUser, signToken } from '../middleware/auth';

export const authRouter = Router();

authRouter.post(
  '/login',
  ah(async (req, res) => {
    const { email, senha } = z.object({ email: z.string().email(), senha: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(senha, user.senha_hash))) throw new HttpError(401, 'CREDENCIAIS_INVALIDAS');
    const payload = { id: user.id, nome: user.nome, fazenda_id: user.fazenda_id, funcao: user.funcao };
    res.json({ token: signToken(payload), user: { ...payload, email: user.email } });
  }),
);

authRouter.get(
  '/me',
  requireUser,
  ah(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.id },
      select: { id: true, nome: true, email: true, funcao: true, fazenda_id: true, fazenda: true },
    });
    res.json(user);
  }),
);
