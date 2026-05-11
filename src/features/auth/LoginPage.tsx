import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HttpError } from '@/lib/http';
import { useAuthStore } from './auth.store';

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

type LoginForm = z.infer<typeof loginSchema>;

function getLoginErrorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.status === 401) return 'Email hoặc mật khẩu không đúng';
    if (err.status >= 500) return 'Máy chủ đang gặp lỗi, vui lòng thử lại sau';
    return `Đăng nhập thất bại (mã ${err.status})`;
  }
  if (err instanceof Error && err.message === 'Network error') {
    return 'Không thể kết nối server';
  }
  return 'Đăng nhập thất bại';
}

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginForm) => {
    setPending(true);
    try {
      await login(data.email, data.password);
      navigate('/builder', { replace: true });
    } catch (err) {
      toast.error(getLoginErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-surface p-8 shadow-xl">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/logo.png"
            alt="Trading Bot"
            className="h-12 w-12 rounded-full object-contain"
            draggable={false}
          />
          <h1 className="text-xl font-bold text-fg">
            Đăng nhập Trading Bot Platform
          </h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-bearish">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-bearish">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={pending}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Đăng nhập
          </Button>
        </form>

        <p className="text-center text-xs text-fg-muted">
          Chưa có tài khoản? Liên hệ admin.
        </p>
      </div>
    </div>
  );
}
