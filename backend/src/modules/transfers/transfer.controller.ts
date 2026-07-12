import { Request, Response } from 'express';
import { parseBody, parseParams, parseQuery, idParamSchema } from '../../lib/validation';
import * as service from './transfer.service';
import { createTransferSchema, decideTransferSchema, listTransfersQuerySchema } from './transfer.schemas';

export async function list(req: Request, res: Response) {
  const query = parseQuery(listTransfersQuerySchema, req);
  res.json(await service.listTransfers(req.user!, query));
}

export async function create(req: Request, res: Response) {
  const input = parseBody(createTransferSchema, req);
  res.status(201).json(await service.createTransfer(req.user!, input));
}

export async function approve(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  const { notes } = parseBody(decideTransferSchema, req);
  res.json(await service.approveTransfer(req.user!, id, notes));
}

export async function reject(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  const { notes } = parseBody(decideTransferSchema, req);
  res.json(await service.rejectTransfer(req.user!, id, notes));
}
