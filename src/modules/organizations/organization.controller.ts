import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DeprecatedEndpoint } from '../../common/decorators/deprecated-endpoint.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { OrganizationRole } from './entities/organization-member.entity';
import { OrganizationService, JwtPayload } from './organization.service';
import {
  AddMemberDto,
  CreateOrganizationDto,
  LoginDto,
} from './dto/organization.dto';

interface JwtRequest {
  member: JwtPayload;
}

@ApiTags('Organizations')
@Controller('v1/organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an organization with owner account' })
  async create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @DeprecatedEndpoint({
    link: '/v1/auth/login',
    sunset: process.env.API_SUNSET_DATE ?? '2026-12-31',
  })
  @ApiOperation({
    summary: 'Login and receive JWT for organization RBAC (deprecated)',
    description: 'Deprecated — use POST /v1/auth/login instead.',
    deprecated: true,
  })
  async login(@Body() dto: LoginDto) {
    return this.organizationService.login(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List organizations for authenticated member' })
  async list(@Req() req: JwtRequest) {
    return this.organizationService.listForMember(req.member.sub);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ORG_OWNER,
    OrganizationRole.ADMIN,
  )
  @ApiOperation({ summary: 'Add a member to an organization' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async addMember(
    @Param('id', ParseUUIDPipe) orgId: string,
    @Req() req: JwtRequest,
    @Body() dto: AddMemberDto,
  ) {
    return this.organizationService.addMember(orgId, req.member.sub, dto);
  }

  @Get(':id/members')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List organization members' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async listMembers(
    @Param('id', ParseUUIDPipe) orgId: string,
    @Req() req: JwtRequest,
    @Query() query: PaginationQueryDto,
  ) {
    return this.organizationService.listMembers(orgId, req.member.sub, query);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ORG_OWNER,
    OrganizationRole.ADMIN,
  )
  @ApiOperation({ summary: 'Remove a member from an organization' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'memberId', format: 'uuid' })
  async removeMember(
    @Param('id', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: JwtRequest,
  ) {
    return this.organizationService.removeMember(
      orgId,
      req.member.sub,
      memberId,
    );
  }
}
