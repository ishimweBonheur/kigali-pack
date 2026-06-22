import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
  BadRequestException,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { TierThrottlerGuard } from '../../common/guards/tier-throttler.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CalculateTaxDto } from './dto/calculate-tax.dto';
import { RraPayrollService } from './rra-payroll.service';
import {
  ApiErrorResponseDto,
  ApiSuccessResponseDto,
} from '../../common/dto/api-response.dto';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';

@ApiTags('Compliance')
@ApiBearerAuth()
@Controller('v1/compliance')
@UseGuards(ApiKeyGuard, TierThrottlerGuard)
export class KycController {
  constructor(private readonly rraPayrollService: RraPayrollService) {}

  @Get('nida/mock/:nationalId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mock NIDA identity lookup by national ID' })
  @ApiParam({ name: 'nationalId', example: '1200780064278123' })
  @ApiResponse({ status: 200, description: 'Contextual sandbox identity profile returned' })
  async runMockKycProfileLookup(
    @Param('nationalId') nationalId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const scrubbedId = nationalId.replace(/\s+/g, '');
    const nidaFormatPattern = /^1(19|20)\d{2}[78]\d{8}\d{2}$/;

    if (!nidaFormatPattern.test(scrubbedId)) {
      throw new BadRequestException(
        `Malformed National ID parameter string. Pattern violation. Input length: ${scrubbedId.length}`,
      );
    }

    const developerAccount = req.developer;
    const genderIdentifierDigit = scrubbedId.charAt(5);
    const resolvedGender = genderIdentifierDigit === '8' ? 'MALE' : 'FEMALE';
    const embeddedBirthYear = scrubbedId.slice(1, 5);

    return {
      queryStatus: 'SUCCESS',
      sourceRegistry: 'NIDA_MOCK_SANDBOX',
      recordFound: true,
      identity: {
        nationalId: scrubbedId,
        firstName: developerAccount.developerName.split(' ')[0] || 'Developer',
        lastName:
          developerAccount.developerName.split(' ').slice(1).join(' ') ||
          'Profile',
        gender: resolvedGender,
        birthYear: embeddedBirthYear,
        civilStatus: null,
        placeOfIssue: null,
      },
      attestationToken: 'jwt_mock_nida_attestation_signature_hash_stream',
    };
  }

  @Post('rra/taxes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Compute RRA PAYE and VAT breakdown' })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  async computeRraTaxBrackets(@Body() dto: CalculateTaxDto) {
    const paye = this.rraPayrollService.calculatePaye(dto.grossSalary);
    const structuralVatComponent = dto.grossSalary * 0.18;

    return {
      calculatedAt: new Date().toISOString(),
      currency: 'RWF',
      inputGrossSalary: dto.grossSalary,
      statutoryDeductions: {
        payeProgressiveTax: paye.payeTax,
        standardVatEighteenPercent: Math.round(structuralVatComponent),
        netTakeHomeAfterPaye: Math.round(dto.grossSalary - paye.payeTax),
      },
    };
  }

  @Post('rra/rssb')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate RSSB pension and maternity contributions',
    description:
      'Employee pension 3%, employer pension 5%, employee maternity 0.3%, employer maternity 0.3%.',
  })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  async computeRssbContributions(@Body() dto: CalculateTaxDto) {
    const rssb = this.rraPayrollService.calculateRssb(dto.grossSalary);
    return {
      data: rssb,
      message: 'RSSB contributions calculated successfully',
    };
  }

  @Post('rra/payroll-summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Full payroll summary combining PAYE and RSSB deductions',
  })
  @ApiResponse({ status: 200, type: ApiSuccessResponseDto })
  @ApiResponse({ status: 400, type: ApiErrorResponseDto })
  async computePayrollSummary(@Body() dto: CalculateTaxDto) {
    const summary = this.rraPayrollService.calculatePayrollSummary(
      dto.grossSalary,
    );
    return {
      data: summary,
      message: 'Payroll summary calculated successfully',
    };
  }

  @Get('boilerplates/scaffold')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({
    summary: 'Retrieve recommended project boilerplate template',
    description: 'Public endpoint — no authentication required.',
  })
  async retrieveBoilerplateTemplateStructure() {
    return {
      templateName: 'NestJS-NextJS-Momo-Stack',
      architectureStyle: 'Modular-Monolith-Integration',
      recommendedDependencies: {
        frontend: ['@tanstack/react-query', 'lucide-react', 'clsx'],
        backend: ['@nestjs/axios', 'class-validator', 'typeorm'],
      },
      envBoilerplateLayout: [
        'KIGALI_PACK_KEY=kp_test_your_secret_token_here',
        'KIGALI_PACK_URL=https://api.kigalipack.rw/v1',
        'MOCK_CALLBACK_TUNNEL=https://your-ngrok-tunnel.ngrok-free.app/payments/webhook',
      ],
    };
  }
}
