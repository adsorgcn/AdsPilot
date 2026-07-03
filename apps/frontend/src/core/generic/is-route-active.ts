const ROOT_PATH = '/';

/**
 * @name isRouteActive
 * @description A function to check if a route is active. This is used to
 * highlight the active link in the navigation.
 * @param targetLink - The link to check against
 * @param currentRoute - the current route
 * @param depth - how far down should segments be matched?
 */
export default function isRouteActive(
  targetLink: string,
  currentRoute: string,
  depth: number
) {
  // we remove any eventual query param from the route's URL
  const currentRoutePath = currentRoute.split('?')[0];

  if (!isRoot(currentRoutePath) && isRoot(targetLink)) {
    return false;
  }

  if (!currentRoutePath.includes(targetLink)) {
    return false;
  }

  const isSameRoute = targetLink === currentRoutePath;

  if (isSameRoute) {
    return true;
  }

  return hasMatchingSegments(targetLink, currentRoutePath, depth);
}

function splitIntoSegments(href: string) {
  return href.split('/').filter(Boolean);
}

function hasMatchingSegments(
  targetLink: string,
  currentRoute: string,
  depth: number
) {
  const segments = splitIntoSegments(targetLink);
  const matchingSegments = numberOfMatchingSegments(currentRoute, segments);

  if (targetLink === currentRoute) {
    return true;
  }

  // how far down should segments be matched?
  // - if depth = 1 => only highlight the links of the immediate parent
  // - if depth = 2 => for url = /settings match /settings/organization/members
  return matchingSegments > segments.length - (depth - 1);
}

function numberOfMatchingSegments(href: string, segments: string[]) {
  let count = 0;

  for (const segment of splitIntoSegments(href)) {
    // for as long as the segments match, keep counting + 1
    if (segments.includes(segment)) {
      count += 1;
    } else {
      return count;
    }
  }

  return count;
}

function isRoot(path: string) {
  return path === ROOT_PATH;
}
