import { z } from 'zod'

const email = z
  .string()
  .trim()
  .min(1, 'Informe seu e-mail.')
  .email('Informe um e-mail válido.')
  .max(320)

export const loginSchema = z.object({
  email,
  password: z
    .string()
    .min(1, 'Informe sua senha.')
    .max(72, 'A senha deve ter no máximo 72 caracteres.'),
})

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Informe seu nome.')
      .max(120, 'O nome deve ter no máximo 120 caracteres.'),
    email,
    password: z
      .string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres.')
      .max(72, 'A senha deve ter no máximo 72 caracteres.')
      .regex(/[a-z]/, 'Inclua uma letra minúscula.')
      .regex(/[A-Z]/, 'Inclua uma letra maiúscula.')
      .regex(/\d/, 'Inclua um número.')
      .regex(/[^A-Za-z0-9]/, 'Inclua um símbolo.'),
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })

export type LoginFormValues = z.infer<typeof loginSchema>
export type RegisterFormValues = z.infer<typeof registerSchema>
