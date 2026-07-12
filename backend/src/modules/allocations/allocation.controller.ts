import { Request, Response } from 'express';
import { parseBody, parseParams, parseQuery, idParamSchema } from '../../lib/validation';
import * as service from './allocation.service';
import {
  createAllocationSchema,
  listAllocationsQuerySchema,
  returnAllocationSchema,
} from './allocation.schemas';

export async function list(req: Request, res: Response) {
  const query = parseQuery(listAllocationsQuerySchema, req);
  res.json(await service.listAllocations(req.user!, query));
}

export async function create(req: Request, res: Response) {
  const input = parseBody(createAllocationSchema, req);
  res.status(201).json(await service.createAllocation(req.user!, input));
}

export async function returnAsset(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  const input = parseBody(returnAllocationSchema, req);
  res.json(await service.returnAllocation(req.user!, id, input));
}
