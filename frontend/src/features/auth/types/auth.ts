/** DTOs mirror backend auth/api/dto records. */
export type LoginRequest = { email: string; password: string }
export type RegisterRequest = { name: string; email: string; password: string }
export type LoginResponse = { accessToken: string; tokenType: 'Bearer'; expiresIn: number }
export type User = { id: string; name: string; email: string }
