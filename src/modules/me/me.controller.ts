import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MeService } from './me.service';
import { UpdateProfileDto } from './dto/me.dto';
import { JwtPayload } from '../organizations/organization.service';
import {
  ApiErrorResponseDto,
  ApiSuccessResponseDto,
} from '../../common/dto/api-response.dto';

interface JwtRequest {
  member: JwtPayload;
}

@ApiTags('Profile')
@ApiBearerAuth('jwt')
@Controller('v1/me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get authenticated member profile' })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  @ApiResponse({ status: 401, type: ApiErrorResponseDto })
  async getProfile(@Req() req: JwtRequest) {
    const profile = await this.meService.getProfile(req.member.sub);
    return { data: profile, message: 'Profile retrieved successfully' };
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update authenticated member profile' })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  async updateProfile(@Req() req: JwtRequest, @Body() dto: UpdateProfileDto) {
    const profile = await this.meService.updateProfile(req.member.sub, dto);
    return { data: profile, message: 'Profile updated successfully' };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete authenticated member account' })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  async deleteProfile(@Req() req: JwtRequest) {
    const result = await this.meService.deleteProfile(req.member.sub);
    return { data: result, message: 'Account deleted successfully' };
  }
}
