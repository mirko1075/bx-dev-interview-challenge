import { Mocked, TestBed } from '@suites/unit';
import { MessageDto } from '../../dtos/message.dto';
import { MessageEntity } from '../../entities/message.entity';
import { AppService } from '../../services/app/app.service';
import { IAppService } from '../../services/app/app.service.interface';
import { Mapper } from '../../utils/mapper/mapper';
import { AppController } from './app.controller';

jest.mock('../utils/mapper/mapper');

describe('AppController', () => {
  let appController: AppController;
  let appService: Mocked<IAppService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(AppController).compile();

    appController = unit;
    appService = unitRef.get(AppService);

    jest.spyOn(Mapper, 'mapData').mockImplementation();
  });

  describe('getHello', () => {
    it('should call the service', () => {
      appController.getHello();

      expect(appService.getHello).toHaveBeenCalledWith();
    });

    it('should call the mapper with the result from the service', () => {
      const message = 'Hello World!';
      const resultFromService = new MessageEntity(message);
      appService.getHello.mockReturnValue(resultFromService);
      const mapDataSpy = jest.spyOn(Mapper, 'mapData');
      appController.getHello();

      expect(mapDataSpy).toHaveBeenCalledWith(MessageDto, resultFromService);
    });

    it('should return the value from the mapper', () => {
      const resultFromService = new MessageEntity('any message');
      const expectedResult = new MessageDto('any dto');

      appService.getHello.mockReturnValue(resultFromService);
      jest.spyOn(Mapper, 'mapData').mockReturnValue(expectedResult);

      const result = appController.getHello();

      expect(result).toBe(expectedResult);
    });
  });
});
