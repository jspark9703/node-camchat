export class SuccessResponseDto<T = any> {
  success!: boolean;
  message!: string;
  data?: T;
}

