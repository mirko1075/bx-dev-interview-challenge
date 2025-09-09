import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class PresignedUploadDto {
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  fileType: string;

  @IsOptional()
  @IsNumber()
  @Min(60) // Minimum 1 minute
  @Max(3600) // Maximum 1 hour
  expiresIn?: number = 3600;
}
