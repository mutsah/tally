import { AuthCard } from '@/components/auth/auth-card';
import { RegisterForm } from '@/components/auth/register-form';

export default function RegisterPage() {
  return (
    <AuthCard subtitle="Create your account">
      <RegisterForm />
    </AuthCard>
  );
}
