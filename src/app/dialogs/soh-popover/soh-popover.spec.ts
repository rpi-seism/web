import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SohPopover } from './soh-popover';

describe('SohPopover', () => {
  let component: SohPopover;
  let fixture: ComponentFixture<SohPopover>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SohPopover]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SohPopover);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
