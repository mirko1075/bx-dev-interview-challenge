// src/debug/debug.controller.ts

import { Controller, Logger, Get, Post, Body } from '@nestjs/common';
import { S3Service } from '../files/s3.service';
import { FilesService } from '../files/files.service';

@Controller('debug')
export class DebugController {
  private readonly logger = new Logger(DebugController.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly filesService: FilesService,
  ) {}

  @Get('s3-connection')
  async testS3Connection() {
    try {
      const isConnected = await this.s3Service.testConnection();
      return {
        success: isConnected,
        message: isConnected ? 'S3 connection successful' : 'S3 connection failed',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('S3 connection test error:', error.message);
      return {
        success: false,
        message: `S3 connection error: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Post('test-presigned-url')
  async testPresignedUrl(@Body() body: { filename: string; fileType: string }) {
    try {
      const { filename, fileType } = body;
      
      // Test primary method
      let primaryResult;
      let primaryError;
      try {
        primaryResult = await this.s3Service.getPresignedUploadUrl(filename);
        this.logger.debug(`Primary method succeeded for ${filename}`);
      } catch (error) {
        primaryError = error.message;
        this.logger.warn(`Primary method failed for ${filename}:`, error.message);
      }

      // Test alternative method if available
      let alternativeResult;
      let alternativeError;
      try {
        alternativeResult = await this.s3Service.getPresignedUploadUrlAlternative(filename);
        this.logger.debug(`Alternative method succeeded for ${filename}`);
      } catch (error) {
        alternativeError = error.message;
        this.logger.warn(`Alternative method failed for ${filename}:`, error.message);
      }

      const hasSuccessfulMethod = primaryResult || alternativeResult;

      return {
        success: !!hasSuccessfulMethod,
        primary: primaryResult ? {
          url: primaryResult.uploadUrl.substring(0, 100) + '...',
          key: primaryResult.key,
          urlLength: primaryResult.uploadUrl.length,
          containsSignature: primaryResult.uploadUrl.includes('Signature='),
          containsExpires: primaryResult.uploadUrl.includes('Expires='),
          hasStorageLocal: primaryResult.uploadUrl.includes('storage.local'),
        } : { error: primaryError },
        alternative: alternativeResult ? {
          url: alternativeResult.uploadUrl.substring(0, 100) + '...',
          key: alternativeResult.key,
          urlLength: alternativeResult.uploadUrl.length,
          containsSignature: alternativeResult.uploadUrl.includes('Signature='),
          containsExpires: alternativeResult.uploadUrl.includes('Expires='),
          hasStorageLocal: alternativeResult.uploadUrl.includes('storage.local'),
        } : { error: alternativeError },
        advice: hasSuccessfulMethod 
          ? this.generateAdvice(primaryResult?.uploadUrl || alternativeResult?.uploadUrl || '')
          : [
              'Both URL generation methods failed',
              'Check S3 Ninja container status',
              'Verify environment variables',
              'Check AWS SDK configuration',
            ],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Presigned URL test error:', error.message, error.stack);
      return {
        success: false,
        error: error.message,
        advice: [
          'Check S3 Ninja is running on correct port',
          'Verify S3_ENDPOINT environment variable',
          'Check AWS credentials configuration',
          'Try restarting S3 Ninja container',
        ],
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('environment-check')
  async checkEnvironment() {
    const requiredVars = [
      'S3_ENDPOINT',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
      'S3_BUCKET_NAME',
    ];

    const envStatus = requiredVars.map(varName => ({
      name: varName,
      isSet: !!process.env[varName],
      value: varName.includes('SECRET') ? '***' : process.env[varName],
    }));

    const allSet = envStatus.every(env => env.isSet);

    return {
      success: allSet,
      environment: envStatus,
      missing: envStatus.filter(env => !env.isSet).map(env => env.name),
      recommendations: allSet ? [] : [
        'Set missing environment variables in your .env file',
        'Restart the application after setting variables',
        'Check docker-compose.yml environment section',
      ],
      timestamp: new Date().toISOString(),
    };
  }

  @Post('validate-upload-flow')
  async validateUploadFlow(@Body() body: { filename: string; fileType: string; size: number }) {
    const validationResults = [];
    let overallSuccess = true;

    try {
      // Test 1: Environment check
      const envCheck = await this.checkEnvironment();
      validationResults.push({
        test: 'Environment Variables',
        success: envCheck.success,
        details: envCheck,
      });
      if (!envCheck.success) overallSuccess = false;

      // Test 2: S3 Connection
      const connectionCheck = await this.testS3Connection();
      validationResults.push({
        test: 'S3 Connection',
        success: connectionCheck.success,
        details: connectionCheck,
      });
      if (!connectionCheck.success) overallSuccess = false;

      // Test 3: Presigned URL Generation
      const urlCheck = await this.testPresignedUrl(body);
      validationResults.push({
        test: 'Presigned URL Generation',
        success: urlCheck.success,
        details: urlCheck,
      });
      if (!urlCheck.success) overallSuccess = false;

      // Test 4: URL Structure Analysis
      if (urlCheck.success && (urlCheck.primary?.url || urlCheck.alternative?.url)) {
        const testUrl = urlCheck.primary?.url || urlCheck.alternative?.url;
        const urlAnalysis = this.analyzePresignedUrl(testUrl + 'dummy-params'); // Add dummy to make it a complete URL for analysis
        validationResults.push({
          test: 'URL Structure Analysis',
          success: urlAnalysis.isValid,
          details: urlAnalysis,
        });
        if (!urlAnalysis.isValid) overallSuccess = false;
      }

      return {
        overallSuccess,
        validationResults,
        recommendations: this.generateRecommendations(validationResults),
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      return {
        overallSuccess: false,
        error: (error as Error).message,
        validationResults,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private generateAdvice(url: string): string[] {
    const advice = [];
    
    if (!url.includes('Signature=')) {
      advice.push('URL missing signature - check AWS SDK configuration');
    }
    
    if (!url.includes('Expires=')) {
      advice.push('URL missing expiration - check getSignedUrl parameters');
    }
    
    if (url.includes('storage.local')) {
      advice.push('WARNING: URL contains storage.local - should be replaced with localhost');
    }
    
    if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
      advice.push('URL should contain localhost or 127.0.0.1 for local development');
    }
    
    if (advice.length === 0) {
      advice.push('URL structure looks correct');
    }
    
    return advice;
  }

  private analyzePresignedUrl(url: string) {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      
      return {
        isValid: !!(params.get('Signature') && params.get('Expires')),
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port,
        pathname: urlObj.pathname,
        hasSignature: !!params.get('Signature'),
        hasExpires: !!params.get('Expires'),
        hasCredential: !!params.get('X-Amz-Credential'),
        expiresAt: params.get('Expires') ? new Date(parseInt(params.get('Expires')) * 1000).toISOString() : null,
        signatureVersion: params.get('X-Amz-SignedHeaders') ? 'v4' : 'v2',
        allParams: Array.from(params.entries()),
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Invalid URL format: ${error.message}`,
      };
    }
  }

  private generateRecommendations(validationResults: any[]): string[] {
    const recommendations = [];
    
    const failedTests = validationResults
