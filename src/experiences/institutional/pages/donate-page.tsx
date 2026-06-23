import { InstitutionalInteriorPage } from '@/experiences/institutional/components/institutional-interior-page'
import { donatePageContent } from '@/experiences/institutional/content/donate-content'
import { DonationCheckoutSection } from '@/features/donations/components/donation-checkout-section'

export function DonatePage() {
  return <InstitutionalInteriorPage content={donatePageContent} afterHero={<DonationCheckoutSection />} />
}
