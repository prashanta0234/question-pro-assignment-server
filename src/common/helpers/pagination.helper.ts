import { PaginatedResult } from '../interfaces/paginated-result.interface';

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  query: { page: number; limit: number },
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / query.limit);
  return {
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages,
      hasNextPage: query.page < totalPages,
      hasPrevPage: query.page > 1,
    },
  };
}
