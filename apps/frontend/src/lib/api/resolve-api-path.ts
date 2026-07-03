const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ?? '';

export default function resolveApiPath(path: string) {
  if (!path) {
    return path;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  if (path.startsWith('/api/')) {
    return API_BASE ? `${API_BASE}${path}` : path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return API_BASE ? `${API_BASE}${normalizedPath}` : normalizedPath;
}
