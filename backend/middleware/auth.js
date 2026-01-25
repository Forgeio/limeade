// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

// Middleware to check if user is the owner of a resource
async function isOwner(resourceType, getOwnerId) {
  return async (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const ownerId = await getOwnerId(req);
      if (ownerId !== req.user.id) {
        return res.status(403).json({ error: `You do not have permission to access this ${resourceType}` });
      }
      next();
    } catch (err) {
      console.error(`Error checking ${resourceType} ownership:`, err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

module.exports = {
  isAuthenticated,
  isOwner,
};
