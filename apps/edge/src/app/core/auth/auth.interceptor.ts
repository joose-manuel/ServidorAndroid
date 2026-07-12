import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { from, switchMap, catchError, timeout } from 'rxjs';
import { SUPABASE_CLIENT } from '../supabase/provide-supabase';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const supabase = inject(SUPABASE_CLIENT);
  return from(supabase.auth.getSession()).pipe(
    timeout(3000),
    switchMap(({ data }) => {
      const token = data.session?.access_token;
      const authReq = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
      return next(authReq);
    }),
    catchError(() => next(req)),
  );
};