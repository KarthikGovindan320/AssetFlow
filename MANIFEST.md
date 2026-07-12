import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/field';
import { useAuth } from '../../lib/auth';
import { AuthLayout } from './AuthLayout';

const schema = z.object({
  email: z.string().trim().email('Entered email is invalid'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login(values.email, values.password);
      navigate('/');
    } catch (err) {
      form.setError('root', {
        message: err instanceof ApiError ? err.message : 'Could not sign in. Please try again.',
      });
    }
  });

  return (
    <AuthLayout title="Sign in" subtitle="Use your organization account to continue.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...form.register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} required>
          <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...form.register('password')} />
        </Field>
        {errors.root && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-[13px] font-medium text-state-lost">
            {errors.root.message}
          </p>
        )}
        <Button type="submit" loading={isSubmitting} className="w-full">
          Sign in
        </Button>
        <div className="flex items-center justify-between text-[13px]">
          <Link to="/forgot-password" className="font-medium text-primary-strong hover:underline">
            Forgot password?
          </Link>
          <Link to="/signup" className="font-medium text-primary-strong hover:underline">
            Create an account
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
