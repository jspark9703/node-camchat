export class TokenResponseDto {
  accessToken!: string;
  user!: {
    id: string;
    email: string;
    name: string;
  };
}


