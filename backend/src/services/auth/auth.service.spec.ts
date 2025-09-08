import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockUserRepository = () => ({
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
});

const mockJwtService = () => ({
  sign: jest.fn(),
});
jest.mock('bcrypt', () => {
  return {
    hash: jest.fn(),
    compare: jest.fn(),
  };
});
describe('AuthService', () => {
  let service: AuthService;
  let userRepository: ReturnType<typeof mockUserRepository>;
  let jwtService: ReturnType<typeof mockJwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepository },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: 'CACHE_MANAGER', useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw ConflictException if email already exists', async () => {
    userRepository.findOneBy.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
    });
    await expect(
      service.register({ email: 'test@example.com', password: 'password' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should hash password, save user, and return user without password', async () => {
    const hash = await bcrypt.hash('password', 10);
    userRepository.findOneBy.mockResolvedValue(null);
    userRepository.create.mockReturnValue({
      id: 1,
      email: 'test@example.com',
    });
    userRepository.save.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
    });
    const result = await service.register({
      email: 'test@example.com',
      password: 'password',
    });
    expect(result).toEqual({ id: 1, email: 'test@example.com' });
    const spy = jest.spyOn(userRepository, 'create');
    expect(spy).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: hash,
    });
    expect(userRepository.save).toHaveBeenCalled();
  });

  it('should return accessToken if credentials are valid', async () => {
    const user = { id: 1, email: 'test@example.com', password: 'password' };
    userRepository.findOne.mockResolvedValue(user);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwtService.sign.mockReturnValue('jwt-token');
    const result = await service.login({
      email: 'test@example.com',
      password: 'password',
    });
    expect(result).toEqual({ accessToken: 'jwt-token' });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 1,
      email: 'test@example.com',
    });
  });

  it('should throw UnauthorizedException if user not found', async () => {
    userRepository.findOne.mockResolvedValue(null);
    await expect(
      service.login({
        email: 'notfound@example.com',
        password: 'password',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException if password is invalid', async () => {
    const user = { id: 1, email: 'test@example.com', password: 'hashed' };
    userRepository.findOne.mockResolvedValue(user);
    await expect(
      service.login({ email: 'test@example.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
