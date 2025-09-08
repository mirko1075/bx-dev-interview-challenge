import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../../services/auth/auth.service';
import { RegisterUserDto } from '../../dtos/register-user.dto';
import { LoginUserDto } from '../../dtos/login-user.dto';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('AuthController', () => {
    let controller: AuthController;
    let authService: AuthService;

    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
    };

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [AuthController],
        providers: [
          {
            provide: AuthService,
            useValue: mockAuthService,
          },
        ],
      }).compile();

      controller = module.get<AuthController>(AuthController);
      authService = module.get<AuthService>(AuthService);
      jest.clearAllMocks();
    });

    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    describe('register', () => {
      it('should call authService.register with correct dto and return result', async () => {
        const dto: RegisterUserDto = {
          email: 'test@gmail.com',
          password: 'pass',
        };
        const result = { id: 1, email: 'test@gmail.com' };
        mockAuthService.register.mockResolvedValue(result);
        const spy = jest.spyOn(authService, 'register');
        await expect(controller.register(dto)).resolves.toEqual(result);
        expect(spy).toHaveBeenCalledWith(dto);
      });
    });

    describe('login', () => {
      it('should call authService.login with correct dto and return result', async () => {
        const dto: LoginUserDto = {
          email: 'test@gmail.com',
          password: 'pass',
        };
        const result = { accessToken: 'token' };
        mockAuthService.login.mockResolvedValue(result);
        const spy = jest.spyOn(authService, 'login');
        await expect(controller.login(dto)).resolves.toEqual(result);
        expect(spy).toHaveBeenCalledWith(dto);
      });
    });
  });
});
