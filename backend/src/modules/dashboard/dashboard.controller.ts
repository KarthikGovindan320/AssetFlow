import { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

export async function kpis(_req: Request, res: Response) {
  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [
    assetsAvailable,
    assetsAllocated,
    maintenanceOpen,
    activeBookings,
    pendingTransfers,
    upcomingReturns,
    overdueReturns,
    overdueList,
    upcomingList,
  ] = await Promise.all([
    prisma.asset.count({ where: { status: 'AVAILABLE' } }),
    prisma.asset.count({ where: { status: 'ALLOCATED' } }),
    prisma.maintenanceRequest.count({
      where: { status: { in: ['PENDING', 'APPROVED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS'] } },
    }),
    prisma.booking.count({ where: { status: 'CONFIRMED', endTime: { gte: now } } }),
    prisma.transferRequest.count({ where: { status: 'REQUESTED' } }),
    prisma.allocation.count({
      where: { returnedAt: null, expectedReturnDate: { gte: now, lte: in7days } },
    }),
    prisma.allocation.count({
      where: { returnedAt: null, expectedReturnDate: { lt: now } },
    }),
    prisma.allocation.findMany({
      where: { returnedAt: null, expectedReturnDate: { lt: now } },
      include: {
        asset: { select: { assetTag: true, name: true } },
        allocatedToUser: { select: { name: true } },
        allocatedToDepartment: { select: { name: true } },
      },
      orderBy: { expectedReturnDate: 'asc' },
      take: 8,
    }),
    prisma.allocation.findMany({
      where: { returnedAt: null, expectedReturnDate: { gte: now, lte: in7days } },
      include: {
        asset: { select: { assetTag: true, name: true } },
        allocatedToUser: { select: { name: true } },
        allocatedToDepartment: { select: { name: true } },
      },
      orderBy: { expectedReturnDate: 'asc' },
      take: 8,
    }),
  ]);

  res.json({
    cards: {
      assetsAvailable,
      assetsAllocated,
      maintenanceOpen,
      activeBookings,
      pendingTransfers,
      upcomingReturns,
    },
    returns: {
      overdueCount: overdueReturns,
      upcomingCount: upcomingReturns,
      overdue: overdueList,
      upcoming: upcomingList,
    },
    generatedAt: now,
  });
}
