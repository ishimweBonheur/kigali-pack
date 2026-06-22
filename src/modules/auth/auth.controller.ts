import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  AuthLoginDto,
  AuthResponseDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
} from './dto/auth.dto';
import {
  ApiErrorResponseDto,
  ApiSuccessResponseDto,
} from '../../common/dto/api-response.dto';

@ApiTags('Authentication')
@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new organization and owner account' })
  @ApiResponse({ status: 201, type: ApiSuccessResponseDto })
  @ApiResponse({ status: 409, type: ApiErrorResponseDto })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return {
      data: result,
      message: 'Registration successful',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive JWT access + refresh tokens' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto })
  async login(@Body() dto: AuthLoginDto) {
    const result = await this.authService.login(dto);
    return {
      data: result,
      message: 'Login successful',
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using a valid refresh token' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto })
  async refresh(@Body() dto: RefreshTokenDto) {
    const result = await this.authService.refresh(dto);
    return {
      data: result,
      message: 'Token refreshed successfully',
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a refresh token (logout)' })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  async logout(@Body() dto: LogoutDto) {
    const result = await this.authService.logout(dto);
    return {
      data: result,
      message: 'Logged out successfully',
    };
  }
}
