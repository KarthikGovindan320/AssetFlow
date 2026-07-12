import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/field';
import { AuthLayout } from './AuthLayout';

const schema = z.object({
  email: z.string().trim().email('Entered email is invalid'),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    console.info('forgot-password submit (API wiring pending)', values.email);
  });

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your account email and we'll send you a reset link.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message} required>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...form.register('email')} />
        </Field>
        <Button type="submit" loading={isSubmitting} className="w-full">
          Send reset link
        </Button>
        <p className="text-center text-[13px]">
          <Link to="/login" className="font-medium text-primary-strong hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
