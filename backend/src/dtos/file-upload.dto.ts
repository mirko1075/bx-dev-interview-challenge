import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class FileUploadDto {
  @IsNotEmpty({ message: 'File is required' })
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
  };

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string;
}
