import { Request, Response } from 'express';
import { parseBody, parseParams, parseQuery, idParamSchema } from '../../lib/validation';
import * as service from './asset.service';
import {
  createAssetSchema,
  listAssetsQuerySchema,
  setAssetStatusSchema,
  updateAssetSchema,
} from './asset.schemas';

export async function list(req: Request, res: Response) {
  const query = parseQuery(listAssetsQuerySchema, req);
  res.json(await service.listAssets(query));
}

export async function locations(_req: Request, res: Response) {
  res.json({ data: await service.listLocations() });
}

export async function get(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  res.json(await service.getAsset(id));
}

export async function create(req: Request, res: Response) {
  const input = parseBody(createAssetSchema, req);
  res.status(201).json(await service.createAsset(req.user!.id, input));
}

export async function update(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  const input = parseBody(updateAssetSchema, req);
  res.json(await service.updateAsset(req.user!.id, id, input));
}

export async function setStatus(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  const { status, reason } = parseBody(setAssetStatusSchema, req);
  res.json(await service.setAssetStatus(req.user!.id, id, status, reason));
}
