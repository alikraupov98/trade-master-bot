import jwt from 'jsonwebtoken';

/**
 * Защищает роуты админ-панели: проверяет JWT из cookie 'admin_token'.
 * Если токен валиден — кладёт данные админа в req.admin и пропускает дальше.
 * Иначе — редиректит на страницу логина.
 */
export function requireAdminAuth(req, res, next) {
  const token = req.cookies?.admin_token;
  if (!token) {
    return res.redirect('/login');
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = payload;
    res.locals.admin = payload; // доступно во всех EJS-шаблонах
    return next();
  } catch (err) {
    res.clearCookie('admin_token');
    return res.redirect('/login');
  }
}

/** Ограничивает доступ к роуту только суперадминам. */
export function requireSuperAdmin(req, res, next) {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).render('error', { message: 'Доступ запрещён: требуется роль суперадмина' });
  }
  return next();
}

export default { requireAdminAuth, requireSuperAdmin };
