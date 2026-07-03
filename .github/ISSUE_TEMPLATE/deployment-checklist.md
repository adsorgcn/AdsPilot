---
name: Deployment Checklist
about: Checklist for production deployments
title: 'Deployment: [Version] to [Environment]'
labels: deployment
assignees: ''
---

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests pass (unit, integration, e2e)
- [ ] Code review completed and approved
- [ ] Security scan completed with no high-severity issues
- [ ] Performance tests pass
- [ ] Documentation updated

### Environment Preparation
- [ ] Environment variables configured
- [ ] Database migrations reviewed
- [ ] Backup created (production only)
- [ ] Monitoring alerts configured
- [ ] Rollback plan prepared

### Security
- [ ] Security headers configured
- [ ] SSL certificates valid
- [ ] API keys rotated (if needed)
- [ ] Access controls verified
- [ ] Audit logs enabled

## Deployment Information

**Version:** 
**Environment:** 
**Deployment Date:** 
**Deployed by:** 

## Post-Deployment Checklist

### Verification
- [ ] Health checks pass
- [ ] Smoke tests pass
- [ ] Critical user flows tested
- [ ] Performance metrics within acceptable range
- [ ] Error rates normal

### Monitoring
- [ ] Application logs reviewed
- [ ] System metrics normal
- [ ] Alerts configured and working
- [ ] Backup verification (production only)

### Communication
- [ ] Stakeholders notified
- [ ] Documentation updated
- [ ] Release notes published
- [ ] Team informed of any issues

## Rollback Plan

**Rollback trigger conditions:**
- [ ] Health checks fail for > 5 minutes
- [ ] Error rate > 5%
- [ ] Critical functionality broken
- [ ] Performance degradation > 50%

**Rollback procedure:**
1. Execute: `./scripts/rollback.sh [environment]`
2. Verify rollback success
3. Investigate and fix issues
4. Communicate status to team

## Notes

<!-- Add any additional notes, concerns, or special instructions -->