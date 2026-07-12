import { Request, Response } from 'express';
import { parseBody, parseParams, idParamSchema } from '../../lib/validation';
import * as service from './category.service';
import { createCategorySchema, updateCategorySchema } from './category.schemas';

export async function list(_req: Request, res: Response) {
  res.json(await service.listCategories());
}

export async function get(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  res.json(await service.getCategory(id));
}

export async function create(req: Request, res: Response) {
  const input = parseBody(createCategorySchema, req);
  res.status(201).json(await service.createCategory(req.user!.id, input));
}

export async function update(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  const input = parseBody(updateCategorySchema, req);
  res.json(await service.updateCategory(req.user!.id, id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  res.json(await service.deleteCategory(req.user!.id, id));
}
