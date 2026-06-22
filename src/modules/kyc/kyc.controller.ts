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

@ApiTags('Compliance')
@ApiBearerAuth()
@Controller('v1/compliance')
@UseGuards(ApiKeyGuard, TierThrottlerGuard)
export class KycController {
  @Get('nida/mock/:nationalId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mock NIDA identity lookup by national ID' })
  @ApiParam({ name: 'nationalId', example: '1200780064278123' })
  @ApiResponse({ status: 200, description: 'Contextual sandbox identity profile returned' })
  async runMockKycProfileLookup(@Param('nationalId') nationalId: string, @Req() req: any) {
    // Sanitize any whitespace padding or hidden line breaks from input source parameters
    const scrubbedId = nationalId.replace(/\s+/g, '');

    // Refactored production-grade NIDA 16-digit regex matcher
    // 1 | BirthYear(4) | Gender(1) | SerialTracking(8) | Checksum(2) = 16 digits
    const nidaFormatPattern = /^1(19|20)\d{2}[78]\d{8}\d{2}$/;
    
    if (!nidaFormatPattern.test(scrubbedId)) {
      throw new BadRequestException(
        `Malformed National ID parameter string. Pattern violation. Input length: ${scrubbedId.length}`,
      );
    }

    // Extract the developer account context attached to the incoming API token
    const developerAccount = req['developer'];
    if (!developerAccount) {
      throw new BadRequestException('Security Context Error: Unable to identify active developer payload.');
    }

    // Extract structural gender value mapping directly from position 5 index byte
    // NIDA National Standard Conventions: 8 = MALE, 7 = FEMALE
    const genderIdentifierDigit = scrubbedId.charAt(5);
    const resolvedGender = genderIdentifierDigit === '8' ? 'MALE' : 'FEMALE';

    // Extract birth year embedded directly in the structural footprint of the ID string
    const embeddedBirthYear = scrubbedId.slice(1, 5);

    return {
      queryStatus: 'SUCCESS',
      sourceRegistry: 'NIDA_MOCK_SANDBOX',
      recordFound: true,
      identity: {
        nationalId: scrubbedId,
        // Pull down the actual credentials the developer signed up with
        firstName: developerAccount.developerName.split(' ')[0] || 'Developer',
        lastName: developerAccount.developerName.split(' ').slice(1).join(' ') || 'Profile',
        gender: resolvedGender,
        birthYear: embeddedBirthYear,
        // Conditional handling: display structural null fields if not explicitly configured in profile
        civilStatus: null,
        placeOfIssue: null,
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
