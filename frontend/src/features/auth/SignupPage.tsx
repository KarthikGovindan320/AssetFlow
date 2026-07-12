import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/field';
import { AuthLayout } from './AuthLayout';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Please enter your full name'),
    email: z.string().trim().email('Entered email is invalid'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function SignupPage() {
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    console.info('signup submit (API wiring pending)', values.email);
  });

  return (
    <AuthLayout title="Create your account" subtitle="New accounts join as Employees; an admin assigns roles.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="name" error={errors.name?.message} required>
          <Input id="name" autoComplete="name" placeholder="Priya Sharma" {...form.register('name')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...form.register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} required>
          <Input id="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" {...form.register('password')} />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
          <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••" {...form.register('confirmPassword')} />
        </Field>
        <Button type="submit" loading={isSubmitting} className="w-full">
          Create account
        </Button>
        <p className="text-center text-[13px] text-ink-soft">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary-strong hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
