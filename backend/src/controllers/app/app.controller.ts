import { Controller, Get, Inject } from '@nestjs/common';
import { IMessageDto, MessageDto } from '../../dtos/message.dto';
import { AppService } from '../../services/app/app.service';
import { Mapper } from '../../utils/mapper/mapper';

@Controller('hello')
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Get()
  getHello(): IMessageDto {
    const entity = this.appService.getHello();

    const dto = Mapper.mapData(MessageDto, entity);
    return dto;
  }
}
