import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class PresignedDownloadDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsOptional()
  @IsNumber()
  @Min(60) // Minimum 1 minute
  @Max(3600) // Maximum 1 hour
  expiresIn?: number = 3600;
}
