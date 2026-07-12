import { Request, Response } from 'express';
import { parseBody, parseParams, parseQuery, idParamSchema } from '../../lib/validation';
import * as service from './employee.service';
import { listEmployeesQuerySchema, setRoleSchema, updateEmployeeSchema } from './employee.schemas';

export async function list(req: Request, res: Response) {
  const query = parseQuery(listEmployeesQuerySchema, req);
  res.json(await service.listEmployees(query));
}

export async function get(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  res.json(await service.getEmployee(id));
}

export async function update(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  const input = parseBody(updateEmployeeSchema, req);
  res.json(await service.updateEmployee(req.user!.id, id, input));
}

export async function setRole(req: Request, res: Response) {
  const { id } = parseParams(idParamSchema, req);
  const { role } = parseBody(setRoleSchema, req);
  res.json(await service.setRole(req.user!.id, id, role));
}
