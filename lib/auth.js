// Auth
module.exports = {
  protectAdminRoutes(req, res, next) {
    if (!req.path.startsWith('/admin')) return next()
    if (req.path.startsWith('/admin/login')) return next()
    if (req.session?.user?.roles?.includes('admin')) return next()
    res.redirect('/admin/login')
  }
}
