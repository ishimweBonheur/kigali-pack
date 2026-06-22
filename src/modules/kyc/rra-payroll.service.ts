import { Injectable } from '@nestjs/common';

export interface PayeResult {
  payeTax: number;
}

export interface RssbBreakdown {
  grossSalary: number;
  currency: 'RWF';
  employeePension: number;
  employerPension: number;
  employeeMaternity: number;
  employerMaternity: number;
  totalEmployeeDeduction: number;
  totalEmployerContribution: number;
}

export interface PayrollSummary {
  grossSalary: number;
  currency: 'RWF';
  payeTax: number;
  employeeRssb: number;
  employerRssb: number;
  totalDeductions: number;
  netTakeHome: number;
  breakdown: {
    paye: PayeResult;
    rssb: RssbBreakdown;
  };
}

@Injectable()
export class RraPayrollService {
  calculatePaye(grossSalary: number): PayeResult {
    let payeTax = 0;

    if (grossSalary <= 60000) {
      payeTax = 0;
    } else if (grossSalary <= 100000) {
      payeTax = (grossSalary - 60000) * 0.1;
    } else if (grossSalary <= 200000) {
      payeTax = 40000 * 0.1 + (grossSalary - 100000) * 0.2;
    } else {
      payeTax = 40000 * 0.1 + 100000 * 0.2 + (grossSalary - 200000) * 0.3;
    }

    return { payeTax: Math.round(payeTax) };
  }

  calculateRssb(grossSalary: number): RssbBreakdown {
    const employeePension = Math.round(grossSalary * 0.03);
    const employerPension = Math.round(grossSalary * 0.05);
    const employeeMaternity = Math.round(grossSalary * 0.003);
    const employerMaternity = Math.round(grossSalary * 0.003);

    return {
      grossSalary,
      currency: 'RWF',
      employeePension,
      employerPension,
      employeeMaternity,
      employerMaternity,
      totalEmployeeDeduction: employeePension + employeeMaternity,
      totalEmployerContribution: employerPension + employerMaternity,
    };
  }

  calculatePayrollSummary(grossSalary: number): PayrollSummary {
    const paye = this.calculatePaye(grossSalary);
    const rssb = this.calculateRssb(grossSalary);
    const totalDeductions = paye.payeTax + rssb.totalEmployeeDeduction;
    const netTakeHome = grossSalary - totalDeductions;

    return {
      grossSalary,
      currency: 'RWF',
      payeTax: paye.payeTax,
      employeeRssb: rssb.totalEmployeeDeduction,
      employerRssb: rssb.totalEmployerContribution,
      totalDeductions,
      netTakeHome,
      breakdown: { paye, rssb },
    };
  }
}
