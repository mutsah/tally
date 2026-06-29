import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import { OAuthUser } from '../interfaces/oauth-user.interface';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID', ''),
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET', ''),
      callbackURL: configService.get<string>(
        'GITHUB_CALLBACK_URL',
        'http://localhost:3002/api/v1/auth/github/callback',
      ),
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (error: Error | null, user?: OAuthUser | false) => void,
  ): Promise<void> {
    const fallbackEmail = (profile as Profile & { _json?: { email?: string } })
      ._json?.email;
    const email = profile.emails?.[0]?.value || fallbackEmail;

    if (!email) {
      return done(
        new UnauthorizedException(
          'No public email returned from GitHub. Add a public email in GitHub and retry.',
        ),
        false,
      );
    }

    const nameParts = profile.displayName?.split(' ') || [];

    const user: OAuthUser = {
      provider: 'github',
      providerId: profile.id,
      email,
      firstName: profile.name?.givenName || nameParts[0],
      lastName: profile.name?.familyName || nameParts.slice(1).join(' '),
    };

    return done(null, user);
  }
}
