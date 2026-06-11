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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CalculateTaxDto } from './dto/calculate-tax.dto';

@ApiTags('Compliance')
@ApiBearerAuth()
@Controller('v1/compliance')
@UseGuards(ApiKeyGuard)
export class KycController {
  @Get('nida/mock/:nationalId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mock NIDA identity lookup by national ID' })
  @ApiParam({ name: 'nationalId', example: '1199780123456789' })
  @ApiResponse({ status: 200, description: 'Mock identity profile returned' })
  async runMockKycProfileLookup(@Param('nationalId') nationalId: string) {
    const scrubbedId = nationalId.replace(/\s+/g, '');

    const nidaFormatPattern = /^1(19|20)\d{2}[78]\d{7}\d{2}$/;
    if (!nidaFormatPattern.test(scrubbedId)) {
      throw new BadRequestException(
        'Malformed National ID parameter string. Pattern violation.',
      );
    }

    const balancingIndicator = parseInt(scrubbedId.slice(-2), 10);
    const resolvedGender = balancingIndicator % 2 === 0 ? 'FEMALE' : 'MALE';

    return {
      queryStatus: 'SUCCESS',
      sourceRegistry: 'NIDA_MOCK_SANDBOX',
      recordFound: true,
      identity: {
        nationalId: scrubbedId,
        firstName: resolvedGender === 'FEMALE' ? 'Divine' : 'Christian',
        lastName: resolvedGender === 'FEMALE' ? 'Uwase' : 'Bizimana',
        gender: resolvedGender,
        birthYear: scrubbedId.slice(1, 5),
        civilStatus: 'SINGLE',
        placeOfIssue: 'Kigali City, Nyarugenge District',
      },
      attestationToken: 'jwt_mock_nida_attestation_signature_hash_stream',
    };
  }

  @Post('rra/taxes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Compute RRA PAYE and VAT breakdown' })
  @ApiResponse({ status: 200, description: 'Tax calculations returned' })
  async computeRraTaxBrackets(@Body() dto: CalculateTaxDto) {
    const amount = dto.grossSalary;
    let payeTax = 0;

    if (amount <= 60000) {
      payeTax = 0;
    } else if (amount <= 100000) {
      payeTax = (amount - 60000) * 0.1;
    } else if (amount <= 200000) {
      payeTax = 40000 * 0.1 + (amount - 100000) * 0.2;
    } else {
      payeTax = 40000 * 0.1 + 100000 * 0.2 + (amount - 200000) * 0.3;
    }

    const structuralVatComponent = amount * 0.18;

    return {
      calculatedAt: new Date().toISOString(),
      currency: 'RWF',
      inputGrossSalary: amount,
      statutoryDeductions: {
        payeProgressiveTax: Math.round(payeTax),
        standardVatEighteenPercent: Math.round(structuralVatComponent),
        netTakeHomeAfterPaye: Math.round(amount - payeTax),
      },
    };
  }

  @Get('boilerplates/scaffold')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve recommended project boilerplate template' })
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
